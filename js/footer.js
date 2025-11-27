/**
 * Footer Logic
 * Menangani update tahun otomatis dan fungsi tambahan footer lainnya
 */
document.addEventListener("DOMContentLoaded", function () {
    // Update Tahun Hak Cipta Otomatis
    const yearSpan = document.getElementById("year");
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // Efek Hover pada Link Footer (Opsional, menambah interaktivitas)
    const footerLinks = document.querySelectorAll('.site-footer a');
    footerLinks.forEach(link => {
        link.addEventListener('mouseenter', () => {
            link.style.opacity = '0.7';
        });
        link.addEventListener('mouseleave', () => {
            link.style.opacity = '1';
        });
    });
});

