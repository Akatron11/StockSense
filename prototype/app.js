// StockSense prototip — paylaşılan etkileşimler (wireframe düzeyi)
function openModal(id){ var e=document.getElementById(id); if(e) e.classList.add('open'); }
function closeModal(id){ var e=document.getElementById(id); if(e) e.classList.remove('open'); }
function toggleClass(id){ var e=document.getElementById(id); if(e) e.classList.toggle('open'); }

// dropdown'ları (kullanıcı menüsü, bildirim zili) dışına tıklayınca kapat
document.addEventListener('click', function(e){
  document.querySelectorAll('.usermenu.open, .bellwrap.open').forEach(function(el){
    if(!el.contains(e.target)) el.classList.remove('open');
  });
});
