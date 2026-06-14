from services.shared.events.event_publisher import EventPublisher

def handle_github_workflow_failed(data):
    # Current AWS implementation: Sync internal call
    # Future Azure implementation: Azure Function triggered by Service Bus
    print("Handling github workflow failed:", data)
