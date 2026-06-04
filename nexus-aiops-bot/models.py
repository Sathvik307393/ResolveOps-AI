from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base
import uuid

def generate_uuid():
    return str(uuid.uuid4())

def generate_api_key():
    return "nx_live_" + str(uuid.uuid4()).replace("-", "")

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    
    api_keys = relationship("ApiKey", back_populates="owner")

class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    key = Column(String, unique=True, index=True, default=generate_api_key)
    name = Column(String, default="Default Key")
    is_active = Column(Boolean, default=True)
    user_id = Column(String, ForeignKey("users.id"))

    owner = relationship("User", back_populates="api_keys")
