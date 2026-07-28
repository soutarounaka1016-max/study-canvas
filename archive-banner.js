const banner = document.createElement("aside");
banner.className = "ocr-archive-banner";
banner.setAttribute("role", "note");
banner.innerHTML = `
  <strong>Study Canvas OCR実験版</strong>
  <span>2026年7月28日時点の観賞・比較用です。手書き認識は実用精度に達しなかったため、正式版では使用していません。</span>
  <a href="../">現在の正式版を開く</a>
`;
document.body.prepend(banner);
document.body.classList.add("is-ocr-archive");
