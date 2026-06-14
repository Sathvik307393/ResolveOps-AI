import os

api_file = 'api.py'
with open(api_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Insert new endpoints before __name__ == '__main__'
endpoints_code = """
@app.get("/api/v1/cloud/azure/cost")
def get_azure_cost(current_user: dict = Depends(get_current_user)):
    try:
        tenant_email = current_user.get("email")
        from database import get_user_integrations
        integrations = get_user_integrations(tenant_email)
        azure_creds = integrations.get("azure", {}).get("credentials", {})
        client_id = azure_creds.get("client_id")
        client_secret = azure_creds.get("client_secret")
        azure_tenant = azure_creds.get("tenant_id")
        
        if not (client_id and client_secret and azure_tenant):
            return {"error": "Azure not connected"}

        from azure.identity import ClientSecretCredential
        from azure.mgmt.subscription import SubscriptionClient
        from azure_cost_service import get_subscription_cost, get_resource_group_cost
        
        credential = ClientSecretCredential(
            tenant_id=azure_tenant,
            client_id=client_id,
            client_secret=client_secret
        )
        
        sub_client = SubscriptionClient(credential)
        subs = list(sub_client.subscriptions.list())
        
        if not subs:
            return {"error": "No subscriptions found"}
            
        sub_id = subs[0].subscription_id
        
        sub_cost = get_subscription_cost(credential, sub_id)
        rg_costs = get_resource_group_cost(credential, sub_id)
        
        return {
            "subscription_id": sub_id,
            "subscription_cost": sub_cost,
            "resource_group_costs": rg_costs
        }
    except Exception as e:
        print(f"Cost Error: {e}")
        return {"error": str(e)}

@app.post("/api/v1/cloud/azure/cost/refresh")
def refresh_azure_cost(current_user: dict = Depends(get_current_user)):
    from azure_cost_service import clear_cost_cache
    clear_cost_cache()
    return {"message": "Cost cache cleared"}

if __name__ == "__main__":
"""
content = content.replace('if __name__ == "__main__":', endpoints_code)

# Insert logic into get_azure_resource_details
replace_target = """            details = {
                "id": r.id,
                "name": r.name,
                "type": r.type,
                "location": r.location,
                "tags": r.tags
            }"""
            
replace_with = """            details = {
                "id": r.id,
                "name": r.name,
                "type": r.type,
                "location": r.location,
                "tags": r.tags
            }
            
            try:
                from azure_cost_service import get_estimated_resource_price
                sku_name = None
                if hasattr(r, 'sku') and r.sku and hasattr(r.sku, 'name'):
                    sku_name = r.sku.name
                
                # Best effort basic cost estimation
                if sku_name:
                    estimated_cost = get_estimated_resource_price(r.type, sku_name, r.location, "INR")
                    details["cost_estimation"] = estimated_cost
                else:
                    details["cost_estimation"] = {
                        "status": "unavailable",
                        "cost_note": "Estimated price unavailable without SKU. Actual usage cost may still appear through Cost Management."
                    }
            except Exception as e:
                print(f"Cost estimation error: {e}")"""

content = content.replace(replace_target, replace_with)

with open(api_file, 'w', encoding='utf-8') as f:
    f.write(content)
print("api.py patched successfully.")
