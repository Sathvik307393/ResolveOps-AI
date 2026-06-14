class EventPublisher:
    def publish(self, topic: str, event_data: dict):
        # Current AWS implementation: Local in-memory or sync processing
        # Future Azure implementation: Azure Service Bus Publisher
        print(f"Publishing to {topic}: {event_data}")
