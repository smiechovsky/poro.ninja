document.addEventListener('DOMContentLoaded', function() {
  const table = document.getElementById('masteryTable');
  if (!table) return;
  const getCellValue = (tr, idx) => {
    const cell = tr.children[idx];
    const dataAttr = cell.dataset[Object.keys(cell.dataset)[0]];
    return dataAttr || (cell.innerText || cell.textContent);
  };
  const comparer = (idx, asc, isNumeric) => (a, b) => {
    const v1 = getCellValue(asc ? a : b, idx);
    const v2 = getCellValue(asc ? b : a, idx);
    if (isNumeric) {
      const num1 = parseInt(v1) || 0;
      const num2 = parseInt(v2) || 0;
      return num1 - num2;
    }
    return v1.localeCompare(v2);
  };
  Array.from(table.querySelectorAll('th')).forEach((th, idx) => {
    if (th.classList.contains('no-sort')) return;
    th.addEventListener('click', function() {
      const isNumeric = ['level','points','progress','tokens'].includes(th.dataset.sort);
      const asc = th.classList.toggle('asc');
      th.classList.toggle('desc', !asc);
      Array.from(table.querySelectorAll('th')).forEach((oth) => { if (oth !== th) { oth.classList.remove('asc','desc'); } });
      const rows = Array.from(table.querySelectorAll('tr:nth-child(n+2)'));
      rows.sort(comparer(idx, asc, isNumeric));
      rows.forEach(tr => table.appendChild(tr));
    });
  });
});


