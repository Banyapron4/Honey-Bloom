/* Honey Bloom - script.js (ใช้ร่วมกันทุกหน้า)
 * - product.html : #filter-bar, #product-list
 * - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
 * - admin.html   : #ordersTable tbody
 * ตรวจหา element ของแต่ละหน้าเอง จึงใส่ไฟล์เดียวได้ทุกหน้า
 */
(function () {
  'use strict';

  var PRODUCTS_URL = 'products.json';
  var ORDER_API_URL = 'https://script.google.com/macros/s/AKfycbywYKu9zCzGJ8Ufg7m32J73iQk2EhVrYuzHc9XqI39SxyAPQ7UeaM_d6quvWa4Bkku-/exec';
  var ORDERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQA2eIvJSBPaKNsHtUiFcNdD_OvFBCWFp_BHEfBrJEg6Ds0bKh9lVAuwgkbnUHd0B9C3kkAmascUVFS/pub?gid=0&single=true&output=csv';

  // ---------- helper ----------
  function h(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  // =====================================================
  // 1) product.html : โหลด products.json -> การ์ด + ตัวกรอง mood
  // =====================================================
  function moodList(p) {
    var m = p.mood;
    if (Array.isArray(m)) {
      return m.map(function (s) { return String(s).trim(); }).filter(Boolean);
    }
    if (typeof m === 'string') {
      return m.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    }
    return [];
  }

  function hasPrice(p) {
    return p.price !== undefined && p.price !== null && p.price !== '' && !isNaN(Number(p.price));
  }

  function buildCard(p) {
    var card = h('article', 'product-card');

    var imgWrap = h('div', 'product-img');
    if (p.image) {
      var img = document.createElement('img');
      img.src = p.image;
      img.alt = p.name || '';
      img.loading = 'lazy';
      img.addEventListener('error', function () {
        img.remove();
        imgWrap.classList.add('no-image');
      });
      imgWrap.appendChild(img);
    } else {
      imgWrap.classList.add('no-image');
    }
    card.appendChild(imgWrap);

    var body = h('div', 'product-body');
    body.appendChild(h('h3', 'product-name', p.name || ''));
    if (p.size) body.appendChild(h('p', 'product-size', p.size));
    body.appendChild(h('p', 'product-price',
      hasPrice(p) ? Number(p.price).toLocaleString('th-TH') + ' บาท' : 'สอบถามราคา'));

    var btn = h('a', 'btn-order', 'สั่งซื้อ');
    var href = 'order.html?item=' + encodeURIComponent(p.name || '');
    if (hasPrice(p)) href += '&price=' + encodeURIComponent(p.price);
    btn.href = href;
    body.appendChild(btn);

    card.appendChild(body);
    return card;
  }

  function initProducts(listEl) {
    var barEl = document.getElementById('filter-bar');
    listEl.textContent = 'กำลังโหลดสินค้า...';

    fetch(PRODUCTS_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (products) {
        var params = new URLSearchParams(window.location.search);
        var current = (params.get('mood') || '').trim();

        var moods = [];
        products.forEach(function (p) {
          moodList(p).forEach(function (m) {
            if (moods.indexOf(m) === -1) moods.push(m);
          });
        });

        function matches(p) {
          if (!current) return true;
          var c = current.toLowerCase();
          return moodList(p).some(function (m) {
            return m.toLowerCase().indexOf(c) !== -1;
          });
        }

        function syncUrl() {
          try {
            var u = new URL(window.location.href);
            if (current) u.searchParams.set('mood', current);
            else u.searchParams.delete('mood');
            window.history.replaceState(null, '', u);
          } catch (e) { /* ไม่เป็นไร */ }
        }

        function renderBar() {
          if (!barEl) return;
          barEl.textContent = '';
          [''].concat(moods).forEach(function (m) {
            var b = h('button', 'filter-btn', m || 'ทั้งหมด');
            b.type = 'button';
            var active = m.toLowerCase() === current.toLowerCase();
            if (active) b.classList.add('active');
            b.setAttribute('aria-pressed', active ? 'true' : 'false');
            b.addEventListener('click', function () {
              current = m;
              syncUrl();
              renderBar();
              renderList();
            });
            barEl.appendChild(b);
          });
        }

        function renderList() {
          listEl.textContent = '';
          var shown = products.filter(matches);
          if (!shown.length) {
            listEl.appendChild(h('p', 'empty-msg', 'ไม่พบสินค้าที่ตรงกับตัวกรอง'));
            return;
          }
          shown.forEach(function (p) { listEl.appendChild(buildCard(p)); });
        }

        renderBar();
        renderList();
      })
      .catch(function (err) {
        console.error(err);
        listEl.textContent = 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง';
      });
  }

  // =====================================================
  // 2) order.html : เติม items / total จาก URL + ส่งคำสั่งซื้อ
  // =====================================================
  function initOrder(form) {
    var params = new URLSearchParams(window.location.search);
    var item = params.get('item');
    var price = params.get('price');

    var itemsEl = document.getElementById('items');
    var totalEl = document.getElementById('total');

    if (item && itemsEl) itemsEl.value = item.trim();
    if (price && totalEl) totalEl.value = price.replace(/,/g, '').trim();

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      function val(id) {
        var n = document.getElementById(id);
        return n ? n.value.trim() : '';
      }

      var payload = {
        customerName: val('customerName'),
        contact: val('contact'),
        items: val('items'),
        total: val('total'),
        note: val('note')
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(ORDER_API_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
        .then(function (res) { window.location.href = 'thankyou.html'; })
        .catch(function (error) {
          console.error(error);
          alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  // =====================================================
  // 3) admin.html : โหลด CSV จาก Google Sheet -> ตาราง
  // =====================================================
  var COLUMNS = ['Date', 'Order ID', 'SKU', 'Product Name', 'Qty', 'Unit Price',
    'Total Sales', 'Unit Cost', 'Total Cost', 'Gross Profit', 'Channel'];
  var NUMERIC_FROM = 4;  // คอลัมน์ Qty เป็นต้นไป (ถึง Gross Profit) จัดชิดขวา
  var NUMERIC_TO = 9;

  // parse CSV เอง: รองรับ "..." , "" แทน " , คอมมา/ขึ้นบรรทัดใหม่ในเครื่องหมายคำพูด, CRLF, BOM
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (inQuotes) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text.charAt(i + 1) === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter(function (r) {
      return r.some(function (cell) { return cell.trim() !== ''; });
    });
  }

  // แปลงวันที่ -> timestamp (รองรับ yyyy-mm-dd, dd/mm/yyyy, mm/dd/yyyy, ปี พ.ศ.)
  function parseDate(s) {
    s = (s || '').trim();
    if (!s) return NaN;
    var m = s.match(/^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (m) {
      var a = +m[1], b = +m[2], c = +m[3];
      var y, mo, d;
      if (m[1].length === 4) { y = a; mo = b; d = c; }
      else {
        y = c;
        if (a > 12) { d = a; mo = b; }
        else if (b > 12) { mo = a; d = b; }
        else { d = a; mo = b; }   // กำกวมให้ถือเป็น วัน/เดือน/ปี
      }
      if (y > 2400) y -= 543;
      if (y < 100) y += 2000;
      return new Date(y, mo - 1, d, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
    }
    var t = Date.parse(s);
    return isNaN(t) ? NaN : t;
  }

  function showRow(tbody, message) {
    tbody.textContent = '';
    var tr = document.createElement('tr');
    var td = h('td', 'empty-msg', message);
    td.colSpan = COLUMNS.length;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function initAdmin(tbody) {
    showRow(tbody, 'กำลังโหลดข้อมูล...');

    fetch(ORDERS_CSV_URL + '&t=' + Date.now())
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);
        if (rows.length < 2) {
          showRow(tbody, 'ยังไม่มีข้อมูลคำสั่งซื้อ');
          return;
        }

        // จับคู่คอลัมน์จากชื่อหัวตาราง ถ้าไม่เจอใช้ตำแหน่งตามลำดับ
        var headerIdx = {};
        rows[0].forEach(function (name, i) {
          headerIdx[name.trim().toLowerCase()] = i;
        });
        var colIndex = COLUMNS.map(function (name, i) {
          var k = name.toLowerCase();
          return headerIdx.hasOwnProperty(k) ? headerIdx[k] : i;
        });

        var records = rows.slice(1).map(function (r, i) {
          var cells = colIndex.map(function (ci) { return (r[ci] || '').trim(); });
          return { cells: cells, idx: i, ts: parseDate(cells[0]) };
        });

        // เรียงล่าสุดก่อน: ถ้าอ่านวันที่ได้ทุกแถวให้เรียงตามวันที่
        // ไม่เช่นนั้นกลับลำดับแถว (แถวใหม่ใน Sheet อยู่ท้ายสุด)
        var allValid = records.every(function (r) { return !isNaN(r.ts); });
        records.sort(function (a, b) {
          if (allValid && a.ts !== b.ts) return b.ts - a.ts;
          return b.idx - a.idx;
        });

        tbody.textContent = '';
        records.forEach(function (rec) {
          var tr = document.createElement('tr');
          rec.cells.forEach(function (value, i) {
            var td = h('td', (i >= NUMERIC_FROM && i <= NUMERIC_TO) ? 'num' : '', value);
            tr.appendChild(td);
          });
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) {
        console.error(err);
        showRow(tbody, 'โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      });
  }

  // ---------- เริ่มทำงานตามหน้าที่เปิดอยู่ ----------
  function init() {
    var list = document.getElementById('product-list');
    if (list) initProducts(list);

    var form = document.getElementById('orderForm');
    if (form) initOrder(form);

    var tbody = document.querySelector('#ordersTable tbody');
    if (tbody) initAdmin(tbody);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
