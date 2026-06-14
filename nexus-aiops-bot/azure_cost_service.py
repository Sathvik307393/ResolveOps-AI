import datetime
import os
import json
import requests
from typing import Dict, Any, List
from azure.mgmt.costmanagement import CostManagementClient
from azure.mgmt.costmanagement.models import QueryDefinition, QueryDataset, QueryTimePeriod, QueryGrouping, QueryAggregation
from azure.core.exceptions import HttpResponseError
from datetime import timezone

# Simple in-memory cache. Note: Resets when container restarts.
_cost_cache = {}
CACHE_TTL_SECONDS = 900 # 15 minutes

def get_currency_symbol(currency_code: str) -> str:
    symbols = {
        "INR": "₹",
        "USD": "$",
        "EUR": "€",
        "GBP": "£",
        "AUD": "A$",
        "CAD": "C$"
    }
    return symbols.get(currency_code, currency_code + " ")

def get_cached_cost(cache_key: str) -> Any:
    if cache_key in _cost_cache:
        cached_time, data = _cost_cache[cache_key]
        if (datetime.datetime.now() - cached_time).total_seconds() < CACHE_TTL_SECONDS:
            return data
    return None

def set_cached_cost(cache_key: str, data: Any):
    _cost_cache[cache_key] = (datetime.datetime.now(), data)

def get_subscription_cost(credentials, subscription_id: str) -> Dict[str, Any]:
    """Fetches month-to-date actual cost for the subscription."""
    cache_key = f"sub_cost_{subscription_id}"
    cached = get_cached_cost(cache_key)
    if cached:
        return cached

    scope = f"/subscriptions/{subscription_id}"
    client = CostManagementClient(credentials=credentials)
    
    # Time period: start of month to today
    now = datetime.datetime.now()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end_date = now + datetime.timedelta(days=1)
    
    try:
        query_result = client.query.usage(
            scope=scope,
            parameters=QueryDefinition(
                type="Usage",
                timeframe="Custom",
                time_period=QueryTimePeriod(
                    from_property=start_of_month,
                    to=end_date
                ),
                dataset=QueryDataset(
                    granularity="None",
                    aggregation={
                        "totalCost": QueryAggregation(name="PreTaxCost", function="Sum")
                    }
                )
            )
        )
        
        cost_value = 0.0
        currency = "INR" # Default fallback per requirement
        
        if query_result.rows and len(query_result.rows) > 0:
            row = query_result.rows[0]
            cost_value = float(row[0])
            if len(row) > 1 and row[1]:
                currency = str(row[1])

        result = {
            "currency": currency,
            "currency_symbol": get_currency_symbol(currency),
            "month_to_date_actual": round(cost_value, 2),
            "last_updated": datetime.datetime.now(timezone.utc).isoformat(),
            "status": "actual_available",
            "source": {"actual_cost": "Azure Cost Management API"},
            "limitations": []
        }
        
    except HttpResponseError as e:
        if e.status_code == 403:
            result = {
                "currency": "INR",
                "currency_symbol": get_currency_symbol("INR"),
                "month_to_date_actual": 0.0,
                "last_updated": datetime.datetime.now(timezone.utc).isoformat(),
                "status": "permission_required",
                "source": {},
                "limitations": ["Azure cost data could not be loaded. Assign Cost Management Reader permission to the NexusAI service principal at subscription scope."]
            }
        else:
            result = {
                "currency": "INR",
                "currency_symbol": get_currency_symbol("INR"),
                "month_to_date_actual": 0.0,
                "last_updated": datetime.datetime.now(timezone.utc).isoformat(),
                "status": "unavailable",
                "source": {},
                "limitations": [f"Failed to fetch cost: {str(e)}"]
            }
    except Exception as e:
        result = {
            "currency": "INR",
            "currency_symbol": get_currency_symbol("INR"),
            "month_to_date_actual": 0.0,
            "last_updated": datetime.datetime.now(timezone.utc).isoformat(),
            "status": "unavailable",
            "source": {},
            "limitations": [f"Error calculating cost: {str(e)}"]
        }
        
    set_cached_cost(cache_key, result)
    return result

def get_resource_group_cost(credentials, subscription_id: str) -> Dict[str, Dict[str, Any]]:
    """Fetches MTD actual cost grouped by resource group."""
    cache_key = f"rg_cost_{subscription_id}"
    cached = get_cached_cost(cache_key)
    if cached:
        return cached

    scope = f"/subscriptions/{subscription_id}"
    client = CostManagementClient(credentials=credentials)
    
    now = datetime.datetime.now()
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end_date = now + datetime.timedelta(days=1)
    
    rg_costs = {}
    
    try:
        query_result = client.query.usage(
            scope=scope,
            parameters=QueryDefinition(
                type="Usage",
                timeframe="Custom",
                time_period=QueryTimePeriod(
                    from_property=start_of_month,
                    to=end_date
                ),
                dataset=QueryDataset(
                    granularity="None",
                    aggregation={
                        "totalCost": QueryAggregation(name="PreTaxCost", function="Sum")
                    },
                    grouping=[
                        QueryGrouping(type="Dimension", name="ResourceGroup")
                    ]
                )
            )
        )
        
        if query_result.rows:
            for row in query_result.rows:
                cost_val = float(row[0])
                rg_name = str(row[2]) if len(row) > 2 else "Unknown"
                currency = str(row[1]) if len(row) > 1 else "INR"
                
                if rg_name != "Unknown":
                    rg_costs[rg_name.lower()] = {
                        "month_to_date_actual": round(cost_val, 2),
                        "currency": currency,
                        "currency_symbol": get_currency_symbol(currency)
                    }
                    
    except Exception:
        # Gracefully handle missing permissions or errors for RGs
        pass
        
    set_cached_cost(cache_key, rg_costs)
    return rg_costs

def get_estimated_resource_price(resource_type: str, sku: str, location: str, currency: str = "INR") -> Dict[str, Any]:
    """Fetches estimated running price using Azure Retail Prices API."""
    if not sku:
        return {
            "status": "unavailable",
            "cost_note": "Estimated price unavailable without SKU."
        }
        
    cache_key = f"retail_price_{resource_type}_{sku}_{location}_{currency}"
    cached = get_cached_cost(cache_key)
    if cached:
        return cached
        
    api_url = f"https://prices.azure.com/api/retail/prices?currencyCode={currency}"
    
    # Best-effort matching query
    # Compute: armRegionName eq 'centralindia' and armSkuName eq 'Standard_D2s_v3' and priceType eq 'Consumption'
    
    sku_clean = sku.replace(" ", "")
    query_filter = f"armRegionName eq '{location}' and armSkuName eq '{sku_clean}' and priceType eq 'Consumption'"
    
    try:
        response = requests.get(f"{api_url}&$filter={query_filter}", timeout=5)
        response.raise_for_status()
        data = response.json()
        
        if data.get("Items") and len(data["Items"]) > 0:
            # Get the first matching item (usually pay-as-you-go)
            item = data["Items"][0]
            hourly_cost = item.get("retailPrice", 0.0)
            
            result = {
                "currency": currency,
                "currency_symbol": get_currency_symbol(currency),
                "estimated_hourly_running": round(hourly_cost, 4),
                "estimated_daily_running": round(hourly_cost * 24, 2),
                "estimated_monthly_running": round(hourly_cost * 730, 2), # average hours in month
                "cost_status": "estimated_only",
                "cost_note": "Estimated running price is based on Azure Retail Prices and resource SKU/region. Actual billed cost may vary."
            }
            set_cached_cost(cache_key, result)
            return result
            
        # Try finding a partial match if strict match failed
        query_filter_fallback = f"armRegionName eq '{location}' and skuName eq '{sku_clean}'"
        response_fb = requests.get(f"{api_url}&$filter={query_filter_fallback}", timeout=5)
        data_fb = response_fb.json()
        
        if data_fb.get("Items") and len(data_fb["Items"]) > 0:
            item = data_fb["Items"][0]
            hourly_cost = item.get("retailPrice", 0.0)
            
            result = {
                "currency": currency,
                "currency_symbol": get_currency_symbol(currency),
                "estimated_hourly_running": round(hourly_cost, 4),
                "estimated_daily_running": round(hourly_cost * 24, 2),
                "estimated_monthly_running": round(hourly_cost * 730, 2),
                "cost_status": "estimated_only",
                "cost_note": "Estimated running price is based on Azure Retail Prices and resource SKU/region. Actual billed cost may vary."
            }
            set_cached_cost(cache_key, result)
            return result
            
    except Exception as e:
        print(f"Retail price fetch error: {str(e)}")
        
    # If no matching SKU is found
    result = {
        "status": "unavailable",
        "cost_note": "Estimated price unavailable for this resource SKU/region. Actual usage cost may still appear through Cost Management."
    }
    set_cached_cost(cache_key, result)
    return result

def clear_cost_cache():
    global _cost_cache
    _cost_cache = {}

