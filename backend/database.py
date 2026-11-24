from datetime import datetime
from pathlib import Path
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import declarative_base, sessionmaker

BASE_DIR = Path(__file__).resolve().parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'investigation.db'}"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    case_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class CDRRecord(Base):
    __tablename__ = "cdr_records"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    source_file = Column(String, nullable=True)
    row_number = Column(Integer, nullable=True)
    caller_num = Column(String, nullable=True)
    receiver_num = Column(String, nullable=True)
    call_type = Column(String, nullable=True)
    start_time = Column(DateTime, nullable=True)
    duration_sec = Column(Integer, nullable=True)
    imei = Column(String, nullable=True)
    imsi = Column(String, nullable=True)
    tower_id = Column(String, nullable=True)


class IPDRRecord(Base):
    __tablename__ = "ipdr_records"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False, index=True)
    source_file = Column(String, nullable=True)
    row_number = Column(Integer, nullable=True)
    subscriber_num = Column(String, nullable=True)
    public_ip = Column(String, nullable=True)
    source_port = Column(Integer, nullable=True)
    dest_ip = Column(String, nullable=True)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    service_hint = Column(String, nullable=True)


class CellTower(Base):
    __tablename__ = "cell_towers"

    tower_id = Column(String, primary_key=True, index=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    address = Column(String, nullable=True)
    operator = Column(String, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_role = Column(String, nullable=True)
    action = Column(String, nullable=False)
    query_text = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def log_audit_entry(
    db: sessionmaker,
    action: str,
    query_text: str = "",
    user_role: str = "investigator",
):
    try:
        entry = AuditLog(
            user_role=user_role,
            action=action,
            query_text=query_text,
            timestamp=datetime.utcnow(),
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()

