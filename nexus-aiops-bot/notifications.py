import boto3
import os
import json
import logging

logger = logging.getLogger(__name__)

class NotificationDispatcher:
    """Base class for all outbound notifications."""
    def send(self, recipient: str, subject: str, message: str) -> bool:
        raise NotImplementedError

class EmailDispatcher(NotificationDispatcher):
    """
    Dispatches notifications exclusively via Email (AWS SES).
    If SES is not configured, it falls back to local logging.
    """
    def __init__(self):
        self.region = os.getenv("AWS_REGION", "us-east-1")
        self.sender_email = os.getenv("NEXUS_SENDER_EMAIL", "nexus-alerts@example.com")
        self.ses_client = None
        self.mock_mode = False
        
        try:
            # Check if credentials exist
            if os.getenv("AWS_ACCESS_KEY_ID"):
                self.ses_client = boto3.client('ses', region_name=self.region)
                # Attempt to get identity verification status
                # If it fails, we fall back to mock mode safely
                self.ses_client.get_send_quota()
            else:
                self.mock_mode = True
        except Exception as e:
            logger.warning(f"SES initialization failed, falling back to local mock mode: {e}")
            self.mock_mode = True

    def send(self, recipient: str, subject: str, message: str) -> bool:
        if self.mock_mode:
            # Fallback for local development or unverified SES accounts
            mock_payload = {
                "recipient": recipient,
                "subject": subject,
                "message": message
            }
            logger.info(f"MOCK EMAIL DISPATCHED to {recipient}: {subject}")
            
            with open("local_emails_mock.json", "a") as f:
                f.write(json.dumps(mock_payload) + "\n")
            return True

        # Send via AWS SES
        try:
            response = self.ses_client.send_email(
                Source=self.sender_email,
                Destination={
                    'ToAddresses': [recipient]
                },
                Message={
                    'Subject': {
                        'Data': subject,
                        'Charset': 'UTF-8'
                    },
                    'Body': {
                        'Html': {
                            'Data': message,
                            'Charset': 'UTF-8'
                        }
                    }
                }
            )
            logger.info(f"SES Email sent! Message ID: {response['MessageId']}")
            return True
        except Exception as e:
            logger.error(f"Failed to send SES email: {e}")
            # Fallback to local
            with open("local_emails_mock.json", "a") as f:
                f.write(json.dumps({"recipient": recipient, "subject": subject, "error": str(e)}) + "\n")
            return False

# Global Dispatcher Instance
email_dispatcher = EmailDispatcher()

def notify_incident_created(tenant_email: str, incident_id: str, service: str, severity: str):
    """Sends an email when a new incident is detected."""
    subject = f"[{severity}] Nexus AI Alert: Incident {incident_id} on {service}"
    html_body = f"""
    <h2>Nexus AI Incident Alert</h2>
    <p>A new infrastructure anomaly has been detected and registered.</p>
    <ul>
        <li><strong>Incident ID:</strong> {incident_id}</li>
        <li><strong>Affected Service:</strong> {service}</li>
        <li><strong>Severity:</strong> {severity}</li>
    </ul>
    <p>The AI RCA engine is currently analyzing the logs. You will receive the full report shortly.</p>
    """
    return email_dispatcher.send(tenant_email, subject, html_body)

def notify_rca_completed(tenant_email: str, incident_id: str, service: str, rca_report: str):
    """Sends an email containing the full RCA report."""
    subject = f"Nexus AI RCA Report: Incident {incident_id} ({service})"
    # Convert markdown to simple HTML line breaks for the email
    formatted_rca = rca_report.replace("\n", "<br>")
    
    html_body = f"""
    <h2>Nexus AI Root Cause Analysis</h2>
    <p>The RCA for Incident <strong>{incident_id}</strong> on <strong>{service}</strong> is complete.</p>
    <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #4F46E5; font-family: monospace;">
        {formatted_rca}
    </div>
    <p><a href="http://localhost:8501">View Details in Nexus Dashboard</a></p>
    """
    return email_dispatcher.send(tenant_email, subject, html_body)
