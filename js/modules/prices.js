window.GreatnessApp = window.GreatnessApp || {};
window.GreatnessApp.initPrices = function () {
 const allItems=window.GreatnessBuyerData;
 let activeBuyer="equipment", items=allItems.filter(i=>i.buyer===activeBuyer);
 const buyerTabs=document.querySelectorAll("[data-buyer]");
 const list=document.getElementById('buyer-items'), search=document.getElementById('price-search'), select=document.getElementById('calc-item-select'), quantity=document.getElementById('calc-quantity'), buy=document.getElementById('calc-buy-price');
 const catalog=window.GreatnessBuyerCatalog;
 const unitText=item=>(item.priceAmount===.1?'0,1': '1')+' '+(item.unit||'шт.');
 const money=n=>'$ '+Math.round(n).toLocaleString('uk-UA');
 const marketMin=item=>item.market.length?Math.min(...item.market.map(o=>o.price)):null;
 const prefill=()=>{const item=items.find(i=>i.id===select.value);buy.value=String(marketMin(item)??'');};
 const range=item=>[Math.min(...item.observations.map(o=>o.price)),Math.max(...item.observations.map(o=>o.price))];
 const text=(tag,cls,value)=>{const el=document.createElement(tag);el.className=cls;el.textContent=value;return el;};
 function populate(){select.replaceChildren(); items.forEach(item=>{const option=document.createElement('option');option.value=item.id;option.textContent=item.name;select.append(option);});select.value=items[0].id;}
 function calculate(){
  const item=items.find(i=>i.id===select.value),q=Math.max(0,(Number(quantity.value)||0)/(item.priceAmount||1)),[min,max]=range(item);
  document.getElementById('res-base').textContent=money(min*q)+' - '+money(max*q);
  const valid=buy.value.trim()!==''&&Number.isFinite(Number(buy.value))&&Number(buy.value)>=0;
  document.getElementById('res-cost').textContent=valid?money(Number(buy.value)*q):'Введи ціну';
  document.querySelector('label[for="calc-quantity"]').textContent='Кількість, '+(item.unit||'шт.');quantity.step=item.unit==='кг'?'0.1':'1';quantity.min=quantity.step;document.querySelector('label[for="calc-buy-price"]').textContent='Ціна покупки за '+unitText(item)+', $';const latest=item.observations.at(-1);document.getElementById('calc-demand-warning').textContent=latest.demand===0?'На останньому скріншоті попит 0: продаж недоступний. Розрахунок лише для порівняння.':'';
  const total=document.getElementById('res-total');total.textContent=valid?money((min-Number(buy.value))*q)+' - '+money((max-Number(buy.value))*q):'Введи ціну';total.style.color=valid&&max<Number(buy.value)?'#ff8585':'var(--accent-yellow)';
 }
 function render(){list.replaceChildren();const filtered=items.filter(i=>i.name.toLocaleLowerCase('uk').includes(search.value.trim().toLocaleLowerCase('uk')));
 filtered.forEach(item=>{const [min,max]=range(item),row=text('article','buyer-row','');
 const identity=text('div','buyer-identity',''),img=document.createElement('img');img.src=item.image;img.alt='';img.width=76;img.height=76;identity.append(img);
 const title=text('div','','');title.append(text('h4','',item.name));title.append(text('small','',item.truncated?'Назва скорочена в грі':(catalog[activeBuyer].title+' · '+unitText(item))));identity.append(title);row.append(identity);
 const bounds=text('div','buyer-bounds','');for(const [label,value,cls] of [['Мін. зафіксована',min,''],['Макс. зафіксована',max,'buyer-max']]){const cell=text('div',cls,'');cell.append(text('small','',label),text('strong','',money(value)));bounds.append(cell);}row.append(bounds);
 const market=text('div','buyer-market','');market.append(text('small','','Юмаркет'));if(item.market.length){const vals=item.market.map(o=>o.price);market.append(text('strong','',money(Math.min(...vals))+' - '+money(Math.max(...vals))),text('small','',item.market.at(-1).date.split('-').reverse().join('.')));}else market.append(text('span','','Немає даних'));row.append(market);
 const button=text('button','btn-calc-add','Рахувати');button.type='button';button.addEventListener('click',()=>{select.value=item.id;prefill();calculate();select.focus();});row.append(button);
 const history=text('details','buyer-history','');history.append(text('summary','',item.observations.some(o=>o.hot)?item.observations.length+' спостереження · 🔥 була гаряча ціна':item.observations.length+' спостереження'));item.observations.forEach(o=>history.append(text('div','',o.date.split('-').reverse().join('.')+' · '+money(o.price)+(o.hot?' · Гаряча ціна':'')+(o.demand!==undefined?' · Попит: '+o.demand+' шт.':''))));if(item.observations.at(-1).demand===0)history.append(text('div','buyer-demand-warning','Останнє спостереження: попит 0, продаж недоступний'));row.append(history);if(item.market.length){const offers=text('details','buyer-offers','');offers.append(text('summary','',item.market.length+' видимих оголошень · Юмаркет'));item.market.forEach(o=>offers.append(text('div','',money(o.price)+' / шт. · '+o.quantity+' шт. · '+o.date.split('-').reverse().join('.')+' '+o.time)));row.append(offers);}list.append(row);
 });if(!filtered.length)list.append(text('p','buyer-note','Товарів за цим запитом не знайдено.'));}
 function updateMarketSummary(){const count=items.filter(i=>i.market.length).length;document.getElementById('market-summary').textContent=count?count+' товарів з цінами оголошень · 02.10.2026':'Поки немає спостережень.';}
 search.addEventListener('input',render);select.addEventListener("change",()=>{prefill();calculate();});[select,quantity,buy].forEach(el=>el.addEventListener('input',calculate));buyerTabs.forEach(button=>button.addEventListener("click",()=>{activeBuyer=button.dataset.buyer;items=allItems.filter(i=>i.buyer===activeBuyer);buyerTabs.forEach(b=>{b.classList.toggle("active",b===button);b.setAttribute("aria-pressed",String(b===button));});search.value="";buy.value="";const meta=catalog[activeBuyer];document.getElementById("buyer-type").textContent="СКУПНИК · "+meta.title.toLocaleUpperCase('uk');document.getElementById("buyer-name").textContent=meta.name;document.getElementById("buyer-count").textContent=items.length+" товарів · історія цін зі скріншотів";document.getElementById("buyer-date").textContent=items.flatMap(i=>i.observations.map(o=>o.date)).sort().at(-1).split('-').reverse().join('.');document.getElementById("buyer-catalog-title").textContent=meta.title;document.getElementById('buyer-unit').textContent='Ціна за '+unitText(items[0])+' · $';updateMarketSummary();populate();prefill();render();calculate();}));updateMarketSummary();populate();prefill();render();calculate();
};
