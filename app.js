
let state={products:[]}
let cart=[]

async function load(){
try{
const r=await fetch('catalogue.json')
state=await r.json()
}catch(e){}
render()
}

function render(){
const grid=document.getElementById('productGrid')
grid.innerHTML=''
(state.products||[]).forEach(p=>{
const d=document.createElement('div')
d.className='card'
d.innerHTML=`<b>${p.name}</b><br><button>Add</button>`
d.querySelector('button').onclick=()=>add(p.id)
grid.appendChild(d)
})
}

function add(id){
const ex=cart.find(x=>x.id===id)
if(ex)ex.qty++
else cart.push({id,qty:1})
renderCart()
}

function renderCart(){
const list=document.getElementById('cartList')
list.innerHTML=''
cart.forEach(c=>{
const d=document.createElement('div')
d.innerHTML=`${c.id} x ${c.qty}`
list.appendChild(d)
})
document.getElementById('cartCount').textContent=cart.length
}

document.getElementById('openCart').onclick=()=>{
document.getElementById('cart').classList.toggle('open')
}

load()
