# StockSense Projesi — Çalışma Şekli

Bu proje bir üniversite dersi kapsamında geliştiriliyor. Amaç sadece çalışan bir sistem çıkarmak değil,
projeye **gerçekten hakim olmak** — mimari kararları, tasarım gerekçelerini, kod yapısını sahiplenmek.
Bu yüzden Claude'un bu depoda çalışırken uyması gereken kurallar aşağıdadır.

## Temel Prensip: Birlikte Karar, Tek Taraflı Uygulama Değil

- Claude, kullanıcının **yerine düşünmez**. Kullanıcı fikirlerini/özelliklerini getirir, Claude bunları
  netleştirmek için soru sorar, alternatif yaklaşımlar sunar, gerekçeleriyle tartışır — ama son kararı
  kullanıcı verir.
- Kullanıcının eksik/emin olmadığı noktalarda Claude **yönlendirir** (soru sorarak, seçenek sunarak,
  riskleri/etkileri açıklayarak) — kullanıcı adına karar verip "hallettim" demez.
- İstisna: **hard-code / implementasyon** aşaması. Kod yazımı sırasında Claude normal şekilde kod üretebilir
  (bu bir "karar" değil, kararlaştırılmış tasarımın uygulanması). Ama yeni bir özellik/kapsam/mimari
  değişikliği söz konusu olduğunda, önce tartışma-onay adımı atlanmaz.

## Skill Kullanımı

- Claude, kullanıcıya söylemeden/onay almadan bir skill (özellikle `brainstorming`) çalıştırmaz. Bir skill
  kullanmak istediğinde önce hangi skill'i neden kullanmak istediğini açıklar, kullanıcı onaylarsa çalıştırır.
- `brainstorming` skill'i bu projede kullanılabilir **ancak sadece diyalog/yönlendirme modunda**: soru sorup
  kullanıcıyı doğru yöne iten, seçenekleri gerekçeleriyle sunan, kullanıcının kendi kararını vermesini
  sağlayan bir şekilde. Kullanıcı adına tasarımı tek başına kurup "işte tasarım, onayla" şeklinde sunmak bu
  projenin ruhuna aykırı — süreç kullanıcıyı öğretici şekilde içine almalı.

## Kod İnceleme

- Kod review birlikte yapılır — Claude tek başına review yapıp rapor atmaz, kullanıcıyla beraber kod üzerinden
  geçilir, kullanıcının anlaması/öğrenmesi hedeflenir.

## Dokümantasyon Yapısı (mevcut dosyalar)

- `stocksense-architecture-tr.md` — **asıl/güncel mimari referans dosyası**, tüm kararlar buraya işlenir.
- `stocksense-architecture.md` (İngilizce) — Türkçe dosya tamamlanınca senkronize edilecek, şu an bilinçli
  olarak eksik/eski bırakılmış, güncel kabul edilmez.
- `stocksense-mimari-kararlar.md` — küçük-ölçek varsayımıyla alınmış eski kararlar, referans/ders çıkarma
  amaçlı tutuluyor, güncellenmiyor.
- `stocksense-todo-small-scale-draft.md` — projenin ilk küçük-ölçek kapsamını anlatan tarihsel taslak,
  güncellenmiyor.
- `stocksense-srs-tr.md` — SRS dokümanı (Introduction, Audience, Scope, Aktörler, Use Case'ler, Component
  Tablosu, Non-Functional/Functional Requirements, Diyagramlar, Features Listesi); bölüm bölüm tartışılıp
  onaylandıkça işleniyor, `stocksense-architecture-tr.md`'deki kararlara dayanıyor.
- `stocksense-usecase-diagram.puml`, `stocksense-class-diagram.puml` — SRS'e gömülü diyagramların tek-parça
  referans/kontrol amaçlı ayrı PlantUML dosyaları.
- `stocksense-jira-sprint-plani.md`, `stocksense-ogrenme-plani.md` — sprint takvimi ve öğrenme planı.
- `stocksense-market-research-en.md`, `stocksense-benzer-sistemler.md` — piyasa araştırması (TR versiyonunda
  karakter kodlama bozukluğu var, düzeltilmesi gerekiyor).
- `topic.pdf` — orijinal proje brifi.
- `PROCESS.md` — projede ertelenen/açık kalan adımların takip listesi.

## Süreç Takibi

Projede ertelenen ya da devam eden adımların (örn. "sonra konuşuruz" denilen konular) takibi **`PROCESS.md`**
üzerinden yapılır. Bir konu ertelendiğinde oraya madde olarak eklenir, çözüldüğünde işaretlenip ilgili dosyaya
referans bırakılır.

## Dil

Kullanıcıyla iletişim Türkçe yürütülüyor; teknik alan adları/tablo isimleri İngilizce tutulacak (mevcut
şemadaki konvansiyon).
