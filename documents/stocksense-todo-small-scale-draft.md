# TODO

## StockSense — Proje Kapsamı (Brife Göre, Toparlanmış)

### POS & Envanter
- [ ] Çalışan bir POS/checkout akışı: personel ürün seçer, adet girer, satışı tamamlar, stok otomatik düşer.
- [ ] Aynı anda iki terminalden son 1 adete "yarışma" senaryosunda concurrency güvenliği (biri satışı alır, diğeri reddedilir).
- [ ] Manager stok ekleyip düzenleyebilir, güncel seviyeleri görebilir.
- [ ] Configurable düşük-stok uyarı eşiği — ürün eşiğin altına düşünce manager'a **uyarı** gösterilir (otomatik sipariş verme yok, bu kapsam dışı).
- [ ] Barkod donanımı gerektirmeden hızlı manuel SKU/kod girişi.

### Raporlama
- [ ] Ürün/kategori bazlı satış raporu, seçilebilir tarih aralığı.
- [ ] Gerçek satış verisinden best-seller / slow-mover tespiti.

### Mağaza Düzeni Önerisi (Projenin Asıl Farklılaşma Noktası)
- [ ] Kombinasyonlu (birlikte sık satılan) ürünleri gerçek satış verisinden tespit etme (co-occurrence veya Apriori yöntemiyle — henüz kesinleşmedi).
- [ ] Bu ürünleri manager'a **rapor** olarak sunma.
- [ ] Aynı öneriyi basit bir **kat planı / floor-plan diyagramı** üzerinde görselleştirme (sadece metin değil).
- [ ] (Opsiyonel, en düşük öncelik) Önerilen düzeni simüle edip tahmini iyileşme metriği gösterme.

### Mobil Companion App
- [ ] Manager için salt-okunur mobil uygulama: stok seviyeleri, uyarılar, raporları görüntüleme (tam POS işlevi değil).

### Kapsam Dışı (Bilinçli Olarak Yapılmayacak)
- Otomatik tedarikçiye sipariş geçme / purchase order yönetimi.
- Varyant/seri numarası takibi gibi ileri envanter özellikleri.
- Computer-vision tabanlı raf/stok tespiti, robotik/AR mağaza rehberliği.
