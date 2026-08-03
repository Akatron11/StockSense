"""Sıfırdan test verisi — Swagger UI üzerinden manuel API testleri için.

Tek seferlik script: `python seed_test_data.py` ile çalıştırılır. Var olan test
verisini temizleyip (aynı subdomain'e sahip company varsa) yeniden oluşturur.
"""

from datetime import date, time, timedelta

from app.database import SessionLocal
from app.models import (
    Branch,
    Company,
    Employee,
    Product,
    Region,
    Return,
    ReturnItem,
    Sale,
    SaleItem,
    Shift,
    Stock,
    StockRequest,
)
from app.security import hash_password

SUBDOMAIN = "testco"
PASSWORD = "Test1234!"
PIN = "1234"


def main() -> None:
    db = SessionLocal()
    try:
        existing = db.query(Company).filter(Company.subdomain == SUBDOMAIN).one_or_none()
        if existing is not None:
            print(f"Var olan '{SUBDOMAIN}' şirketi siliniyor (id={existing.id})...")
            branch_ids = db.query(Branch.id).join(Region).filter(Region.company_id == existing.id)
            sale_ids = db.query(Sale.id).filter(Sale.branch_id.in_(branch_ids))
            return_ids = db.query(Return.id).filter(Return.sale_id.in_(sale_ids))
            db.query(ReturnItem).filter(ReturnItem.return_id.in_(return_ids)).delete(synchronize_session=False)
            db.query(Return).filter(Return.id.in_(return_ids)).delete(synchronize_session=False)
            db.query(SaleItem).filter(SaleItem.sale_id.in_(sale_ids)).delete(synchronize_session=False)
            db.query(Sale).filter(Sale.id.in_(sale_ids)).delete(synchronize_session=False)
            db.query(StockRequest).filter(StockRequest.branch_id.in_(branch_ids)).delete(synchronize_session=False)
            db.query(Shift).filter(
                Shift.employee_id.in_(db.query(Employee.id).filter(Employee.company_id == existing.id))
            ).delete(synchronize_session=False)
            db.query(Employee).filter(Employee.company_id == existing.id).delete()
            db.query(Stock).filter(Stock.branch_id.in_(branch_ids)).delete(synchronize_session=False)
            db.query(Product).filter(Product.company_id == existing.id).delete()
            db.query(Branch).filter(
                Branch.region_id.in_(db.query(Region.id).filter(Region.company_id == existing.id))
            ).delete(synchronize_session=False)
            db.query(Region).filter(Region.company_id == existing.id).delete()
            db.delete(existing)
            db.commit()

        # vendor_manager tenant-üstüdür (company_id NULL) — yukarıdaki temizlik bir company'ye bağlı
        # olduğu için bunu yakalamaz, eski script çalıştırmalarından kalan olası bir kaydı ayrıca temizle.
        db.query(Employee).filter(Employee.username == "vendormgr1").delete()
        db.commit()

        company = Company(name="Test Market", subdomain=SUBDOMAIN)
        db.add(company)
        db.flush()

        region = Region(name="Marmara", company_id=company.id)
        db.add(region)
        db.flush()

        branch1 = Branch(name="Kadıköy Şube", region_id=region.id)
        branch2 = Branch(name="Beşiktaş Şube", region_id=region.id)
        db.add_all([branch1, branch2])
        db.flush()

        pin_hash = hash_password(PIN)
        pwd_hash = hash_password(PASSWORD)

        employees = [
            Employee(
                first_name="Cem", last_name="Kasiyer", username="cashier1",
                password_hash=pwd_hash, role="cashier", branch_id=branch1.id,
                company_id=company.id, age=25, address="Test Adres 1",
            ),
            Employee(
                first_name="Banu", last_name="SubeMuduru", username="branchmgr1",
                password_hash=pwd_hash, role="branch_manager", branch_id=branch1.id,
                company_id=company.id, age=35, address="Test Adres 2",
            ),
            Employee(
                first_name="Recep", last_name="BolgeMuduru", username="regionmgr1",
                password_hash=pwd_hash, role="region_manager", region_id=region.id,
                company_id=company.id, age=40, address="Test Adres 3",
            ),
            Employee(
                first_name="Gizem", last_name="GenelMudur", username="genmgr1",
                password_hash=pwd_hash, role="general_manager",
                company_id=company.id, age=45, address="Test Adres 4",
            ),
            Employee(
                first_name="Sinan", last_name="StokYoneticisi", username="stockmgr1",
                password_hash=pwd_hash, role="stock_manager", branch_id=branch1.id,
                company_id=company.id, age=30, address="Test Adres 5",
                manager_pin=pin_hash,
            ),
            Employee(
                first_name="Selin", last_name="SatisYoneticisi", username="sellermgr1",
                password_hash=pwd_hash, role="seller_manager", branch_id=branch1.id,
                company_id=company.id, age=32, address="Test Adres 6",
                manager_pin=pin_hash,
            ),
            Employee(
                first_name="Onur", last_name="OperasyonSefi", username="opschief1",
                password_hash=pwd_hash, role="operations_chief", branch_id=branch1.id,
                company_id=company.id, age=38, address="Test Adres 7",
                manager_pin=pin_hash,
            ),
            Employee(
                first_name="Irem", last_name="SirketIT", username="companyit1",
                password_hash=pwd_hash, role="company_it",
                company_id=company.id, age=28, address="Test Adres 8",
            ),
            Employee(
                first_name="Vedat", last_name="SaticiYoneticisi", username="vendormgr1",
                password_hash=pwd_hash, role="vendor_manager",
                age=50, address="Test Adres 9",
            ),
            # İkinci şube — çapraz-şube izolasyon testleri için
            Employee(
                first_name="Deniz", last_name="Kasiyer2", username="cashier2",
                password_hash=pwd_hash, role="cashier", branch_id=branch2.id,
                company_id=company.id, age=26, address="Test Adres 10",
            ),
            Employee(
                first_name="Ayla", last_name="StokYoneticisi2", username="stockmgr2",
                password_hash=pwd_hash, role="stock_manager", branch_id=branch2.id,
                company_id=company.id, age=31, address="Test Adres 11",
                manager_pin=pin_hash,
            ),
            # Login'siz personel (madde 13) — vardiya takibi için, sisteme giriş yapamazlar
            # (username/password_hash NULL), hepsi tek genel "staff" rolünde (kullanıcı kararı, 2026-07-31).
            Employee(
                first_name="Mehmet", last_name="Manav", role="staff", branch_id=branch1.id,
                company_id=company.id, age=42, address="Test Adres 12",
            ),
            Employee(
                first_name="Ali", last_name="Kasap", role="staff", branch_id=branch1.id,
                company_id=company.id, age=48, address="Test Adres 13",
            ),
            Employee(
                first_name="Zeynep", last_name="RafDuzenleyici", role="staff", branch_id=branch1.id,
                company_id=company.id, age=22, address="Test Adres 14",
            ),
        ]
        db.add_all(employees)
        db.flush()

        products = [
            Product(
                company_id=company.id, name="Süt 1L", sku="SKU-MILK-1L",
                category="Süt Ürünleri", default_price=45.90, cost_price=32.00,
                best_before_date=date.today() + timedelta(days=5),  # yaklaşan SKT
            ),
            Product(
                company_id=company.id, name="Ekmek", sku="SKU-BREAD-01",
                category="Fırın", default_price=12.50, cost_price=7.00,
                best_before_date=date.today() + timedelta(days=2),  # yaklaşan SKT
            ),
            Product(
                company_id=company.id, name="Deterjan 3kg", sku="SKU-DETERJAN-3KG",
                category="Temizlik", default_price=189.90, cost_price=140.00,
                best_before_date=None,
            ),
        ]
        db.add_all(products)
        db.flush()

        stock_rows = [
            # Süt — düşük stok tetiklesin (quantity < threshold)
            Stock(product_id=products[0].id, branch_id=branch1.id, quantity=3, low_stock_threshold=10),
            # Ekmek — normal stok
            Stock(product_id=products[1].id, branch_id=branch1.id, quantity=40, low_stock_threshold=15),
            # Deterjan — normal stok, price_override örneği
            Stock(
                product_id=products[2].id, branch_id=branch1.id, quantity=25,
                low_stock_threshold=5, price_override=179.90,
            ),
            # Beşiktaş şubesinde sadece ekmek var (izolasyon testi için)
            Stock(product_id=products[1].id, branch_id=branch2.id, quantity=20, low_stock_threshold=10),
        ]
        db.add_all(stock_rows)

        cashier1, manav, kasap, raf_duzenleyici = employees[0], employees[-3], employees[-2], employees[-1]
        today = date.today()
        shifts = [
            Shift(employee_id=cashier1.id, shift_date=today, start_time=time(9, 0), end_time=time(17, 0)),
            Shift(employee_id=manav.id, shift_date=today, start_time=time(8, 0), end_time=time(16, 0)),
            Shift(employee_id=kasap.id, shift_date=today, start_time=time(10, 0), end_time=time(18, 0)),
            Shift(employee_id=raf_duzenleyici.id, shift_date=today, is_day_off=True),
        ]
        db.add_all(shifts)
        db.commit()

        print("Test verisi oluşturuldu.")
        print(f"  subdomain: {SUBDOMAIN}")
        print(f"  şifre (tüm kullanıcılar): {PASSWORD}")
        print(f"  manager_pin (stock/seller/ops): {PIN}")
        print("  kullanıcı adları:", ", ".join(e.username for e in employees if e.username))
    finally:
        db.close()


if __name__ == "__main__":
    main()
