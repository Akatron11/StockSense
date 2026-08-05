"""Sıfırdan test verisi — Swagger UI üzerinden manuel API testleri için.

Tek seferlik script: `python seed_test_data.py` ile çalıştırılır. Var olan test
verisini temizleyip (aynı subdomain'e sahip company varsa) yeniden oluşturur.
"""

from datetime import date, time, timedelta

from app.database import SessionLocal
from app.models import (
    Branch,
    Company,
    CompanyBranding,
    CompanyFeature,
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
            db.query(CompanyFeature).filter(CompanyFeature.company_id == existing.id).delete()
            db.query(CompanyBranding).filter(CompanyBranding.company_id == existing.id).delete()
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
            Employee(
                first_name="Elif", last_name="SatisYoneticisi2", username="sellermgr2",
                password_hash=pwd_hash, role="seller_manager", branch_id=branch2.id,
                company_id=company.id, age=29, address="Test Adres 15",
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

        new_products = [
            # Süt Ürünleri
            Product(company_id=company.id, name="Yoğurt 500g", sku="SKU-YOGURT-500G", category="Süt Ürünleri", default_price=28.90, cost_price=19.00, best_before_date=date.today() + timedelta(days=6)),
            Product(company_id=company.id, name="Ayran 250ml", sku="SKU-AYRAN-250ML", category="Süt Ürünleri", default_price=9.90, cost_price=6.00, best_before_date=date.today() + timedelta(days=10)),
            Product(company_id=company.id, name="Kaşar Peyniri 400g", sku="SKU-KASAR-400G", category="Süt Ürünleri", default_price=89.90, cost_price=62.00, best_before_date=date.today() + timedelta(days=20)),
            Product(company_id=company.id, name="Beyaz Peynir 500g", sku="SKU-BEYAZPEYNIR-500G", category="Süt Ürünleri", default_price=79.90, cost_price=55.00, best_before_date=date.today() + timedelta(days=25)),
            Product(company_id=company.id, name="Tereyağı 250g", sku="SKU-TEREYAG-250G", category="Süt Ürünleri", default_price=69.90, cost_price=48.00, best_before_date=date.today() + timedelta(days=30)),
            Product(company_id=company.id, name="Krema 200ml", sku="SKU-KREMA-200ML", category="Süt Ürünleri", default_price=34.90, cost_price=24.00, best_before_date=date.today() + timedelta(days=15)),
            # Fırın
            Product(company_id=company.id, name="Tam Buğday Ekmeği", sku="SKU-TBEKMEK-01", category="Fırın", default_price=15.90, cost_price=9.00, best_before_date=date.today() + timedelta(days=2)),
            Product(company_id=company.id, name="Simit", sku="SKU-SIMIT-01", category="Fırın", default_price=8.50, cost_price=4.50, best_before_date=date.today() + timedelta(days=1)),
            Product(company_id=company.id, name="Poğaça", sku="SKU-POGACA-01", category="Fırın", default_price=12.90, cost_price=7.00, best_before_date=date.today() + timedelta(days=2)),
            Product(company_id=company.id, name="Kruvasan", sku="SKU-KRUVASAN-01", category="Fırın", default_price=22.90, cost_price=14.00, best_before_date=date.today() + timedelta(days=3)),
            Product(company_id=company.id, name="Baget Ekmek", sku="SKU-BAGET-01", category="Fırın", default_price=18.90, cost_price=11.00, best_before_date=date.today() + timedelta(days=2)),
            Product(company_id=company.id, name="Yufka", sku="SKU-YUFKA-01", category="Fırın", default_price=24.90, cost_price=16.00, best_before_date=date.today() + timedelta(days=7)),
            # Temizlik
            Product(company_id=company.id, name="Bulaşık Deterjanı 750ml", sku="SKU-BULASIK-750ML", category="Temizlik", default_price=64.90, cost_price=45.00, best_before_date=None),
            Product(company_id=company.id, name="Çamaşır Suyu 1L", sku="SKU-CAMASIRSUYU-1L", category="Temizlik", default_price=39.90, cost_price=26.00, best_before_date=None),
            Product(company_id=company.id, name="Yüzey Temizleyici 500ml", sku="SKU-YUZEYTEMIZ-500ML", category="Temizlik", default_price=49.90, cost_price=33.00, best_before_date=None),
            Product(company_id=company.id, name="Tuvalet Kağıdı 8'li", sku="SKU-TUVALETKAGIDI-8", category="Temizlik", default_price=89.90, cost_price=62.00, best_before_date=None),
            Product(company_id=company.id, name="Kağıt Havlu", sku="SKU-KAGITHAVLU-01", category="Temizlik", default_price=44.90, cost_price=30.00, best_before_date=None),
            Product(company_id=company.id, name="Sıvı Sabun 400ml", sku="SKU-SIVISABUN-400ML", category="Temizlik", default_price=34.90, cost_price=22.00, best_before_date=None),
            # Atıştırmalık
            Product(company_id=company.id, name="Cips 150g", sku="SKU-CIPS-150G", category="Atıştırmalık", default_price=44.90, cost_price=29.00, best_before_date=None),
            Product(company_id=company.id, name="Kraker 200g", sku="SKU-KRAKER-200G", category="Atıştırmalık", default_price=32.90, cost_price=21.00, best_before_date=None),
            Product(company_id=company.id, name="Bisküvi 300g", sku="SKU-BISKUVI-300G", category="Atıştırmalık", default_price=27.90, cost_price=18.00, best_before_date=None),
            Product(company_id=company.id, name="Çikolata 100g", sku="SKU-CIKOLATA-100G", category="Atıştırmalık", default_price=39.90, cost_price=26.00, best_before_date=None),
            Product(company_id=company.id, name="Gofret 45g", sku="SKU-GOFRET-45G", category="Atıştırmalık", default_price=12.90, cost_price=8.00, best_before_date=None),
            Product(company_id=company.id, name="Fıstık 200g", sku="SKU-FISTIK-200G", category="Atıştırmalık", default_price=99.90, cost_price=70.00, best_before_date=None),
            Product(company_id=company.id, name="Kuru Üzüm 200g", sku="SKU-KURUUZUM-200G", category="Atıştırmalık", default_price=34.90, cost_price=23.00, best_before_date=None),
            # İçecek
            Product(company_id=company.id, name="Kola 1L", sku="SKU-KOLA-1L", category="İçecek", default_price=34.90, cost_price=22.00, best_before_date=None),
            Product(company_id=company.id, name="Gazoz 1L", sku="SKU-GAZOZ-1L", category="İçecek", default_price=29.90, cost_price=19.00, best_before_date=None),
            Product(company_id=company.id, name="Meyve Suyu 1L", sku="SKU-MEYVESUYU-1L", category="İçecek", default_price=44.90, cost_price=30.00, best_before_date=None),
            Product(company_id=company.id, name="Maden Suyu 500ml", sku="SKU-MADENSUYU-500ML", category="İçecek", default_price=12.90, cost_price=7.50, best_before_date=None),
            Product(company_id=company.id, name="Su 1.5L", sku="SKU-SU-1_5L", category="İçecek", default_price=9.90, cost_price=5.50, best_before_date=None),
            Product(company_id=company.id, name="Buzlu Çay 500ml", sku="SKU-BUZLUCAY-500ML", category="İçecek", default_price=24.90, cost_price=16.00, best_before_date=None),
            Product(company_id=company.id, name="Enerji İçeceği 250ml", sku="SKU-ENERJI-250ML", category="İçecek", default_price=39.90, cost_price=27.00, best_before_date=None),
            # Şarküteri
            Product(company_id=company.id, name="Zeytin 500g", sku="SKU-ZEYTIN-500G", category="Şarküteri", default_price=74.90, cost_price=52.00, best_before_date=date.today() + timedelta(days=60)),
            Product(company_id=company.id, name="Salam 200g", sku="SKU-SALAM-200G", category="Şarküteri", default_price=54.90, cost_price=38.00, best_before_date=date.today() + timedelta(days=15)),
            Product(company_id=company.id, name="Sucuk 250g", sku="SKU-SUCUK-250G", category="Şarküteri", default_price=89.90, cost_price=63.00, best_before_date=date.today() + timedelta(days=20)),
            Product(company_id=company.id, name="Sosis 300g", sku="SKU-SOSIS-300G", category="Şarküteri", default_price=64.90, cost_price=45.00, best_before_date=date.today() + timedelta(days=15)),
            Product(company_id=company.id, name="Lor Peyniri 250g", sku="SKU-LORPEYNIR-250G", category="Şarküteri", default_price=49.90, cost_price=34.00, best_before_date=date.today() + timedelta(days=12)),
            Product(company_id=company.id, name="Tulum Peyniri 300g", sku="SKU-TULUMPEYNIR-300G", category="Şarküteri", default_price=109.90, cost_price=78.00, best_before_date=date.today() + timedelta(days=30)),
            Product(company_id=company.id, name="Pastırma 150g", sku="SKU-PASTIRMA-150G", category="Şarküteri", default_price=129.90, cost_price=92.00, best_before_date=date.today() + timedelta(days=25)),
            # Kahvaltılık
            Product(company_id=company.id, name="Reçel 350g", sku="SKU-RECEL-350G", category="Kahvaltılık", default_price=44.90, cost_price=29.00, best_before_date=None),
            Product(company_id=company.id, name="Bal 450g", sku="SKU-BAL-450G", category="Kahvaltılık", default_price=149.90, cost_price=105.00, best_before_date=None),
            Product(company_id=company.id, name="Tahin 300g", sku="SKU-TAHIN-300G", category="Kahvaltılık", default_price=79.90, cost_price=55.00, best_before_date=None),
            Product(company_id=company.id, name="Pekmez 400g", sku="SKU-PEKMEZ-400G", category="Kahvaltılık", default_price=69.90, cost_price=47.00, best_before_date=None),
            Product(company_id=company.id, name="Çay 500g", sku="SKU-CAY-500G", category="Kahvaltılık", default_price=89.90, cost_price=60.00, best_before_date=None),
            Product(company_id=company.id, name="Şeker 1kg", sku="SKU-SEKER-1KG", category="Kahvaltılık", default_price=34.90, cost_price=23.00, best_before_date=None),
            Product(company_id=company.id, name="Makarna 500g", sku="SKU-MAKARNA-500G", category="Kahvaltılık", default_price=19.90, cost_price=12.00, best_before_date=None),
            Product(company_id=company.id, name="Salça 700g", sku="SKU-SALCA-700G", category="Kahvaltılık", default_price=54.90, cost_price=36.00, best_before_date=None),
        ]
        products.extend(new_products)
        db.add_all(new_products)
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

        products_by_sku = {p.sku: p for p in products}
        branch1_stocked_ids = {row.product_id for row in stock_rows if row.branch_id == branch1.id}
        for product in products:
            if product.id not in branch1_stocked_ids:
                stock_rows.append(
                    Stock(product_id=product.id, branch_id=branch1.id, quantity=30, low_stock_threshold=10)
                )

        branch2_skus = {
            "SKU-BREAD-01", "SKU-MILK-1L", "SKU-BEYAZPEYNIR-500G", "SKU-ZEYTIN-500G",
            "SKU-MAKARNA-500G", "SKU-SALCA-700G",
            "SKU-CIPS-150G", "SKU-KRAKER-200G", "SKU-BISKUVI-300G", "SKU-CIKOLATA-100G",
            "SKU-GOFRET-45G", "SKU-FISTIK-200G", "SKU-KURUUZUM-200G",
            "SKU-KOLA-1L", "SKU-GAZOZ-1L", "SKU-MEYVESUYU-1L", "SKU-MADENSUYU-500ML",
            "SKU-SU-1_5L", "SKU-BUZLUCAY-500ML", "SKU-ENERJI-250ML",
        }
        branch2_stocked_ids = {row.product_id for row in stock_rows if row.branch_id == branch2.id}
        for sku in branch2_skus:
            product = products_by_sku[sku]
            if product.id not in branch2_stocked_ids:
                stock_rows.append(
                    Stock(product_id=product.id, branch_id=branch2.id, quantity=25, low_stock_threshold=8)
                )

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
