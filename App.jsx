import { useState, useEffect, useCallback, useRef } from "react";

/* ═══════════════════════════════════════════════════
   SUPABASE CONFIG
═══════════════════════════════════════════════════ */
const SB_URL = "https://zeruqsdmbzwgrxkqdikc.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InplcnVxc2RtYnp3Z3J4a3FkaWtjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MDk1NTksImV4cCI6MjA5ODA4NTU1OX0.mtCPiSxtlekVeeAAVpEzCgiv0jZ-KjQrPWKevnGSCzY";

/* ── Auth helpers ── */
const auth = {
  async signUp(email, password) {
    const r = await fetch(`${SB_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: SB_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    return r.json();
  },
  async signIn(email, password) {
    const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SB_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    return r.json();
  },
  async signOut(token) {
    await fetch(`${SB_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` }
    });
  },
  async getUser(token) {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` }
    });
    return r.ok ? r.json() : null;
  },
  async resetPassword(email) {
    const r = await fetch(`${SB_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: SB_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    return r.ok ? {} : r.json();
  },
  async updatePassword(token, password) {
    const r = await fetch(`${SB_URL}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    return r.json();
  }
};

const sb = {
  async get(table, token) {
    const tk = token || localStorage.getItem("tac_token") || SB_KEY;
    const r = await fetch(`${SB_URL}/rest/v1/${table}?order=created_at.asc`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${tk}`, "Content-Type": "application/json" }
    });
    return r.ok ? r.json() : [];
  },
  async insert(table, row) {
    const tk = localStorage.getItem("tac_token") || SB_KEY;
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${tk}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(row)
    });
    return r.json();
  },
  async update(table, id, patch) {
    const tk = localStorage.getItem("tac_token") || SB_KEY;
    const r = await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${tk}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(patch)
    });
    return r.json();
  },
  async upsert(table, row) {
    const tk = localStorage.getItem("tac_token") || SB_KEY;
    const r = await fetch(`${SB_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${tk}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(row)
    });
    return r.json();
  },
  async delete(table, id) {
    const tk = localStorage.getItem("tac_token") || SB_KEY;
    await fetch(`${SB_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${tk}` }
    });
  }
};

/* Map app keys to DB table names & field transforms */
const TABLE = {
  clients:      { table:"clients",      toDb: r=>({ id:r.id, name:r.name, phone:r.phone||"", email:r.email||"", id_num:r.idNum||"", notes:r.notes||"" }), fromDb: r=>({ id:r.id, name:r.name, phone:r.phone||"", email:r.email||"", idNum:r.id_num||"", notes:r.notes||"" }) },
  vehicles:     { table:"vehicles",     toDb: r=>({ id:r.id, client_id:r.clientId, plate:r.plate||"", brand:r.brand||"", model:r.model||"", year:r.year||0, color:r.color||"", vin:r.vin||"", km:r.km||0, fuel:r.fuel||"", notes:r.notes||"" }), fromDb: r=>({ id:r.id, clientId:r.client_id, plate:r.plate||"", brand:r.brand||"", model:r.model||"", year:r.year||0, color:r.color||"", vin:r.vin||"", km:r.km||0, fuel:r.fuel||"", notes:r.notes||"" }) },
  workers:      { table:"workers",      toDb: r=>({ id:r.id, name:r.name, role:r.role||"", phone:r.phone||"", specialty:r.specialty||"", status:r.status||"active" }), fromDb: r=>({ id:r.id, name:r.name, role:r.role||"", phone:r.phone||"", specialty:r.specialty||"", status:r.status||"active" }) },
  appointments: { table:"appointments", toDb: r=>({ id:r.id, client_id:r.clientId, vehicle_id:r.vehicleId, service_id:r.serviceId, date:r.date||"", hour:r.hour||"", status:r.status||"pending", notes:r.notes||"", mechanic:r.mechanic||"" }), fromDb: r=>({ id:r.id, clientId:r.client_id, vehicleId:r.vehicle_id, serviceId:r.service_id, date:r.date||"", hour:r.hour||"", status:r.status||"pending", notes:r.notes||"", mechanic:r.mechanic||"" }) },
  orders:       { table:"orders",       toDb: r=>({ id:r.id, client_id:r.clientId, vehicle_id:r.vehicleId, services:r.services||[], parts:r.parts||[], status:r.status||"active", date:r.date||"", total:r.total||0, notes:r.notes||"", mechanic:r.mechanic||"" }), fromDb: r=>({ id:r.id, clientId:r.client_id, vehicleId:r.vehicle_id, services:r.services||[], parts:r.parts||[], status:r.status||"active", date:r.date||"", total:r.total||0, notes:r.notes||"", mechanic:r.mechanic||"" }) },
  suppliers:    { table:"suppliers",    toDb: r=>({ id:r.id, name:r.name, contact:r.contact||"", phone:r.phone||"", email:r.email||"", category:r.category||"", pay_terms:r.payTerms||"", notes:r.notes||"", status:r.status||"active" }), fromDb: r=>({ id:r.id, name:r.name, contact:r.contact||"", phone:r.phone||"", email:r.email||"", category:r.category||"", payTerms:r.pay_terms||"", notes:r.notes||"", status:r.status||"active" }) },
  inventory:    { table:"inventory",    toDb: r=>({ id:r.id, name:r.name, category:r.category||"", supplier_id:r.supplierId||null, qty:r.qty||0, min_qty:r.minQty||0, price:r.price||0, cost:r.cost||0, unit:r.unit||"", sku:r.sku||"", notes:r.notes||"" }), fromDb: r=>({ id:r.id, name:r.name, category:r.category||"", supplierId:r.supplier_id||"", qty:r.qty||0, minQty:r.min_qty||0, price:r.price||0, cost:r.cost||0, unit:r.unit||"", sku:r.sku||"", notes:r.notes||"" }) },
  accounting:   { table:"accounting",   toDb: r=>({ id:r.id, type:r.type||"income", category:r.category||"", description:r.description||"", amount:r.amount||0, date:r.date||"", ref:r.ref||"", notes:r.notes||"" }), fromDb: r=>({ id:r.id, type:r.type||"income", category:r.category||"", description:r.description||"", amount:r.amount||0, date:r.date||"", ref:r.ref||"", notes:r.notes||"" }) },
  library:      { table:"library",      toDb: r=>({ id:r.id, title:r.title, brand:r.brand||"", model:r.model||"", year:r.year||0, category:r.category||"", upload_date:r.uploadDate||"", file_size:r.fileSize||"", notes:r.notes||"" }), fromDb: r=>({ id:r.id, title:r.title, brand:r.brand||"", model:r.model||"", year:r.year||0, category:r.category||"", uploadDate:r.upload_date||"", fileSize:r.file_size||"", notes:r.notes||"" }) },
  services:     { table:"services",     toDb: r=>({ id:r.id, name:r.name, price:r.price||0, cat:r.cat||"Otros" }), fromDb: r=>({ id:r.id, name:r.name, price:r.price||0, cat:r.cat||"Otros" }) },
  subcontracts: { table:"subcontracts", toDb: r=>({ id:r.id, name:r.name, price:r.price||0, provider:r.provider||"", lead_time:r.leadTime||"", notes:r.notes||"" }), fromDb: r=>({ id:r.id, name:r.name, price:r.price||0, provider:r.provider||"", leadTime:r.lead_time||"", notes:r.notes||"" }) },
  quotes:       { table:"quotes",       toDb: r=>({ id:r.id, client_id:r.clientId, vehicle_id:r.vehicleId||null, description:r.description||"", status:r.status||"pending", services:r.services||[], total:r.total||0, notes:r.notes||"", created_at:r.createdAt||new Date().toISOString() }), fromDb: r=>({ id:r.id, clientId:r.client_id, vehicleId:r.vehicle_id||"", description:r.description||"", status:r.status||"pending", services:r.services||[], total:r.total||0, notes:r.notes||"", createdAt:r.created_at||"" }) },
};

async function loadAll() {
  const [clients,vehicles,workers,appointments,orders,suppliers,inventory,accounting,library,services,subcontracts,quotes] = await Promise.all([
    sb.get("clients"), sb.get("vehicles"), sb.get("workers"), sb.get("appointments"),
    sb.get("orders"), sb.get("suppliers"), sb.get("inventory"), sb.get("accounting"), sb.get("library"),
    sb.get("services"), sb.get("subcontracts"), sb.get("quotes")
  ]);
  const loadedServices = (services||[]).map(TABLE.services.fromDb);
  return {
    clients:      (clients||[]).map(TABLE.clients.fromDb),
    vehicles:     (vehicles||[]).map(TABLE.vehicles.fromDb),
    workers:      (workers||[]).map(TABLE.workers.fromDb),
    appointments: (appointments||[]).map(TABLE.appointments.fromDb),
    orders:       (orders||[]).map(TABLE.orders.fromDb),
    suppliers:    (suppliers||[]).map(TABLE.suppliers.fromDb),
    inventory:    (inventory||[]).map(TABLE.inventory.fromDb),
    accounting:   (accounting||[]).map(TABLE.accounting.fromDb),
    library:      (library||[]).map(TABLE.library.fromDb),
    services:     loadedServices.length ? loadedServices : SERVICES_CAT,
    subcontracts: (subcontracts||[]).map(TABLE.subcontracts.fromDb),
    quotes:       (quotes||[]).map(TABLE.quotes.fromDb),
  };
}

/* ═══════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════ */
const C = {
  bg:       "#0A0E1A",
  surface:  "#111827",
  card:     "#1A2235",
  border:   "#1F2E45",
  borderHi: "#2A3F5F",
  blue:     "#2563EB",
  blueHi:   "#3B82F6",
  cyan:     "#06B6D4",
  green:    "#10B981",
  amber:    "#F59E0B",
  red:      "#EF4444",
  purple:   "#8B5CF6",
  text:     "#F0F4FF",
  textMd:   "#94A3B8",
  textSm:   "#64748B",
};

const fmtCRC = (n) => `₡${Number(n||0).toLocaleString("es-CR")}`;
const today  = () => new Date().toISOString().slice(0,10);
const uid    = () => Math.random().toString(36).slice(2,9);
const fmtDate= (d) => { if(!d) return "—"; const [y,m,dy]=d.split("-"); const M=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"]; return `${dy} ${M[+m-1]} ${y}`; };
const todayLabel = () => new Date().toLocaleDateString("es-CR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

/* ═══════════════════════════════════════════════════
   SEED DATA
═══════════════════════════════════════════════════ */
const d = (offset) => { const dt=new Date(); dt.setDate(dt.getDate()+offset); return dt.toISOString().slice(0,10); };

const SEED_CLIENTS = [
  { id:"c1", name:"Luis Quesada",  phone:"8812-3456", email:"luis@email.com",   idNum:"1-0500-0123", notes:"Cliente frecuente" },
  { id:"c2", name:"María Solís",   phone:"7723-9900", email:"maria@email.com",  idNum:"1-0602-0456", notes:"" },
  { id:"c3", name:"Carlos Mora",   phone:"8899-1122", email:"carlos@email.com", idNum:"2-0311-0789", notes:"Prefiere citas matutinas" },
  { id:"c4", name:"Ana Vargas",    phone:"6612-0034", email:"ana@email.com",    idNum:"1-0755-0321", notes:"" },
  { id:"c5", name:"Pedro Rojas",   phone:"8745-5566", email:"pedro@email.com",  idNum:"3-0214-0654", notes:"" },
];

const SEED_VEHICLES = [
  { id:"v1", clientId:"c1", plate:"ABC-123", brand:"Toyota",  model:"Corolla",  year:2018, color:"Blanco",  vin:"JT2BF22K1W0123456", km:87000, fuel:"Gasolina", notes:"" },
  { id:"v2", clientId:"c2", plate:"DEF-456", brand:"Hyundai", model:"Tucson",   year:2020, color:"Gris",    vin:"KM8J3CA46LU234567", km:45000, fuel:"Gasolina", notes:"" },
  { id:"v3", clientId:"c3", plate:"GHI-789", brand:"Kia",     model:"Sportage", year:2019, color:"Negro",   vin:"KNDPMCAC4K7345678", km:62000, fuel:"Gasolina", notes:"Revisar aceite cada 5000km" },
  { id:"v4", clientId:"c4", plate:"JKL-321", brand:"Honda",   model:"CR-V",     year:2021, color:"Rojo",    vin:"2HKRW2H53MH456789", km:31000, fuel:"Híbrido",  notes:"" },
  { id:"v5", clientId:"c5", plate:"MNO-654", brand:"Mazda",   model:"CX-5",     year:2017, color:"Azul",    vin:"JM3KE4DY5H0567890", km:110000,fuel:"Gasolina", notes:"" },
];

const SERVICES_CAT = [
  { id:"diag",      name:"Diagnóstico computarizado",  price:25000, cat:"Diagnóstico" },
  { id:"oil",       name:"Cambio de aceite",            price:18000, cat:"Mantenimiento" },
  { id:"brake",     name:"Revisión de frenos",          price:15000, cat:"Seguridad" },
  { id:"ac",        name:"Revisión de A/C",             price:20000, cat:"Confort" },
  { id:"suspension",name:"Revisión de suspensión",      price:22000, cat:"Seguridad" },
  { id:"electric",  name:"Sistema eléctrico",           price:30000, cat:"Eléctrico" },
  { id:"tires",     name:"Alineación y balanceo",       price:16000, cat:"Mantenimiento" },
  { id:"general",   name:"Revisión general",            price:35000, cat:"Mantenimiento" },
  { id:"trans",     name:"Servicio de transmisión",     price:45000, cat:"Motor" },
  { id:"timing",    name:"Cambio de banda de tiempo",   price:80000, cat:"Motor" },
];

const HOURS = ["8:00","8:30","9:00","9:30","10:00","10:30","11:00","11:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30"];

const SEED_APPTS = [
  { id:"ap1", clientId:"c4", vehicleId:"v4", serviceId:"ac",        date:d(0),  hour:"11:00", status:"confirmed", notes:"",                 mechanic:"Carlos Bolaños" },
  { id:"ap2", clientId:"c5", vehicleId:"v5", serviceId:"general",   date:d(1),  hour:"9:30",  status:"pending",   notes:"",                 mechanic:"Luis Fernández" },
  { id:"ap3", clientId:"c1", vehicleId:"v1", serviceId:"diag",      date:d(2),  hour:"10:00", status:"pending",   notes:"Luz de check",     mechanic:"Carlos Bolaños" },
  { id:"ap4", clientId:"c2", vehicleId:"v2", serviceId:"oil",       date:d(-2), hour:"9:00",  status:"done",      notes:"",                 mechanic:"Luis Fernández" },
  { id:"ap5", clientId:"c3", vehicleId:"v3", serviceId:"brake",     date:d(-4), hour:"14:00", status:"done",      notes:"Frenos traseros",  mechanic:"Carlos Bolaños" },
];

const SEED_ORDERS = [
  { id:"o1", clientId:"c3", vehicleId:"v3", services:["brake","diag"], parts:[{name:"Pastillas traseras",qty:1,price:28000},{name:"Líquido de frenos",qty:1,price:4500}], status:"completed", date:d(-4), total:62500, notes:"Revisión completa de frenos", mechanic:"Carlos Bolaños" },
  { id:"o2", clientId:"c2", vehicleId:"v2", services:["oil"],          parts:[{name:"Aceite 5W-30 4L",qty:1,price:14000},{name:"Filtro de aceite",qty:1,price:3500}],      status:"completed", date:d(-2), total:35500, notes:"",                       mechanic:"Luis Fernández" },
  { id:"o3", clientId:"c4", vehicleId:"v4", services:["ac"],           parts:[],                                                                                            status:"active",    date:d(0),  total:20000, notes:"Revisar refrigerante",     mechanic:"Carlos Bolaños" },
];

const SEED_WORKERS = [
  { id:"w1", name:"Carlos Bolaños",  role:"Mecánico Senior", phone:"8800-1111", specialty:"Motor y transmisión",  status:"active" },
  { id:"w2", name:"Luis Fernández",  role:"Mecánico",        phone:"8800-2222", specialty:"Eléctrico y A/C",      status:"active" },
  { id:"w3", name:"Gabriela Torres", role:"Administradora",  phone:"8800-3333", specialty:"Gestión y atención",   status:"active" },
];

const SEED_SUPPLIERS = [
  { id:"s1", name:"Repuestos Del Valle", contact:"Marco Ureña",    phone:"2234-5678", email:"ventas@delvalle.cr", category:"Repuestos generales",    payTerms:"30 días", notes:"Principal proveedor", status:"active" },
  { id:"s2", name:"Lubricantes Omega",   contact:"Sonia Picado",   phone:"2256-1122", email:"sonia@omega.cr",     category:"Lubricantes y fluidos",   payTerms:"15 días", notes:"",                    status:"active" },
  { id:"s3", name:"AutoElectric CR",     contact:"Rafael Jiménez", phone:"8899-3344", email:"info@autoelect.cr",  category:"Eléctrico y electrónico", payTerms:"Contado", notes:"Solo WhatsApp",       status:"active" },
  { id:"s4", name:"Frenos y Más",        contact:"Diana Castro",   phone:"2278-9900", email:"ventas@frenosy.cr",  category:"Frenos y seguridad",      payTerms:"30 días", notes:"",                    status:"inactive" },
];

const SEED_INVENTORY = [
  { id:"i1", name:"Aceite 5W-30 4L",        category:"Lubricantes", supplierId:"s2", qty:24, minQty:10, price:14000, cost:9000,  unit:"Unidad", sku:"LUB-001", notes:"" },
  { id:"i2", name:"Filtro de aceite Toyota", category:"Filtros",     supplierId:"s1", qty:8,  minQty:5,  price:4500,  cost:2800,  unit:"Unidad", sku:"FIL-001", notes:"" },
  { id:"i3", name:"Pastillas freno delant.", category:"Frenos",      supplierId:"s4", qty:3,  minQty:4,  price:28000, cost:18000, unit:"Par",    sku:"FRE-001", notes:"" },
  { id:"i4", name:"Líquido de frenos DOT4",  category:"Lubricantes", supplierId:"s2", qty:12, minQty:6,  price:4000,  cost:2500,  unit:"Litro",  sku:"LUB-002", notes:"" },
  { id:"i5", name:"Bujías NGK (x4)",         category:"Encendido",   supplierId:"s1", qty:6,  minQty:4,  price:16000, cost:10000, unit:"Juego",  sku:"ENC-001", notes:"" },
  { id:"i6", name:"Filtro de aire",           category:"Filtros",     supplierId:"s1", qty:10, minQty:5,  price:8500,  cost:5000,  unit:"Unidad", sku:"FIL-002", notes:"" },
  { id:"i7", name:"Refrigerante 1L",          category:"Lubricantes", supplierId:"s2", qty:15, minQty:8,  price:3500,  cost:2000,  unit:"Litro",  sku:"LUB-003", notes:"" },
  { id:"i8", name:"Cable de bujía universal", category:"Eléctrico",   supplierId:"s3", qty:2,  minQty:3,  price:12000, cost:7500,  unit:"Juego",  sku:"ELE-001", notes:"" },
];

const SEED_ACCOUNTING = [
  { id:"ac1", type:"income",  category:"Servicio",   description:"Orden O002 — María Solís",  amount:35500,  date:d(-2), ref:"O002",    notes:"" },
  { id:"ac2", type:"income",  category:"Servicio",   description:"Orden O001 — Carlos Mora",  amount:62500,  date:d(-4), ref:"O001",    notes:"" },
  { id:"ac3", type:"expense", category:"Inventario", description:"Compra aceites y filtros",  amount:45000,  date:d(-5), ref:"COM-01",  notes:"Lubricantes Omega" },
  { id:"ac4", type:"expense", category:"Servicios",  description:"Electricidad del mes",      amount:85000,  date:d(-8), ref:"ELEC-06", notes:"" },
  { id:"ac5", type:"expense", category:"Inventario", description:"Compra pastillas de freno", amount:36000,  date:d(-6), ref:"COM-02",  notes:"Frenos y Más" },
  { id:"ac6", type:"income",  category:"Servicio",   description:"Diagnóstico — Luis Q.",     amount:25000,  date:d(-1), ref:"O003",    notes:"" },
  { id:"ac7", type:"expense", category:"Salarios",   description:"Pago quincenal mecánicos",  amount:320000, date:d(-7), ref:"SAL-Q1",  notes:"" },
];

const SEED_LIBRARY = [
  { id:"lb1", title:"Manual Toyota Corolla 2018",          brand:"Toyota",  model:"Corolla",  year:2018, category:"Manual técnico",       uploadDate:d(-30), fileSize:"12.4 MB", notes:"Manual completo de taller" },
  { id:"lb2", title:"Diagramas eléctricos Hyundai Tucson", brand:"Hyundai", model:"Tucson",   year:2020, category:"Diagramas eléctricos", uploadDate:d(-20), fileSize:"8.1 MB",  notes:"" },
  { id:"lb3", title:"Especificaciones Kia Sportage",       brand:"Kia",     model:"Sportage", year:2019, category:"Manual técnico",       uploadDate:d(-15), fileSize:"15.7 MB", notes:"Incluye procedimientos OBD" },
];

/* ═══════════════════════════════════════════════════
   NAV ITEMS
═══════════════════════════════════════════════════ */
const NAV = [
  { id:"dashboard",   icon:"◈",  label:"Inicio",            group:"principal" },
  { id:"intake",      icon:"🚘", label:"Ingreso de Auto",    group:"taller" },
  { id:"clients",     icon:"👤", label:"Clientes",           group:"taller" },
  { id:"vehicles",    icon:"🚗", label:"Vehículos",          group:"taller" },
  { id:"appointments",icon:"📅", label:"Citas",              group:"taller" },
  { id:"orders",      icon:"📋", label:"Órdenes",            group:"taller" },
  { id:"services",    icon:"🔧", label:"Servicios",          group:"taller" },
  { id:"workers",     icon:"👷", label:"Equipo",             group:"taller" },
  { id:"metrics",     icon:"📊", label:"Métricas",           group:"análisis" },
  { id:"ai_diag",     icon:"🤖", label:"IA Diagnóstico",     group:"ia" },
  { id:"ai_quote",    icon:"💬", label:"IA Presupuesto",     group:"ia" },
  { id:"ai_manual",   icon:"📖", label:"IA Manuales",        group:"ia" },
  { id:"inventory",   icon:"📦", label:"Inventario",         group:"gestión" },
  { id:"suppliers",   icon:"🏭", label:"Proveedores",        group:"gestión" },
  { id:"accounting",  icon:"💰", label:"Contabilidad",       group:"gestión" },
  { id:"library",     icon:"📚", label:"Biblioteca",         group:"gestión" },
  { id:"users",       icon:"🔐", label:"Usuarios",          group:"admin" },
  { id:"subcontracts",icon:"🤝", label:"Subcontrataciones", group:"gestión" },
  { id:"quotes",      icon:"💬", label:"Cotizaciones",      group:"taller" },
];

const GROUPS = {
  principal: "Principal",
  taller:    "Gestión del Taller",
  análisis:  "Análisis",
  ia:        "✨ Inteligencia Artificial",
  gestión:   "Módulos adicionales",
  admin:     "⚙️ Administración",
};

/* ═══════════════════════════════════════════════════
   ROOT APP
═══════════════════════════════════════════════════ */
export default function App() {
  const [session, setSession] = useState(null);   // {token, email}
  const [authChecked, setAuthChecked] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState(null);

  /* ── Check for password recovery link in URL ── */
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("type=recovery")) {
      const params = new URLSearchParams(hash.replace("#", "?"));
      const at = params.get("access_token");
      if (at) {
        setRecoveryToken(at);
        setAuthChecked(true);
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, []);

  /* ── Check existing session on mount ── */
  useEffect(() => {
    if (recoveryToken) return;
    const token = localStorage.getItem("tac_token");
    const email = localStorage.getItem("tac_email");
    if (token && email) {
      const role = localStorage.getItem("tac_role") || "admin";
      auth.getUser(token).then(u => {
        if (u && u.email) setSession({ token, email: u.email, role });
        else { localStorage.removeItem("tac_token"); localStorage.removeItem("tac_email"); localStorage.removeItem("tac_role"); }
        setAuthChecked(true);
      }).catch(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, []);

  const handleLogin = (token, email, role="admin") => {
    localStorage.setItem("tac_token", token);
    localStorage.setItem("tac_email", email);
    localStorage.setItem("tac_role", role);
    setSession({ token, email, role });
  };

  const handleLogout = async () => {
    if (session?.token) await auth.signOut(session.token).catch(()=>{});
    localStorage.removeItem("tac_token");
    localStorage.removeItem("tac_email");
    setSession(null);
  };

  if (recoveryToken) return <ResetPasswordPage token={recoveryToken} onDone={()=>{ setRecoveryToken(null); }} />;
  if (!authChecked) return <Loader />;
  if (!session) return <AuthPage onLogin={handleLogin} />;
  if (session.role === "client") return <ClientPortal session={session} onLogout={handleLogout} />;

  return <MainApp session={session} onLogout={handleLogout} />;
}

function MainApp({ session, onLogout }) {
  const [page, setPage]       = useState("dashboard");
  const [data, setData]       = useState(null);
  const [sideOpen, setSideOpen] = useState(true);
  const [toast, setToast]     = useState(null);
  const [dbReady, setDbReady] = useState(true);

  /* ── Load all data from Supabase on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const loaded = await loadAll();
        // If DB is empty, seed with demo data
        const isEmpty = loaded.clients.length === 0 && loaded.workers.length === 0;
        if (isEmpty) {
          // Insert seed data into Supabase
          await Promise.all([
            ...SEED_CLIENTS.map(r => sb.upsert("clients", TABLE.clients.toDb(r))),
            ...SEED_WORKERS.map(r => sb.upsert("workers", TABLE.workers.toDb(r))),
          ]);
          await Promise.all([
            ...SEED_VEHICLES.map(r => sb.upsert("vehicles", TABLE.vehicles.toDb(r))),
            ...SEED_SUPPLIERS.map(r => sb.upsert("suppliers", TABLE.suppliers.toDb(r))),
          ]);
          await Promise.all([
            ...SEED_APPTS.map(r => sb.upsert("appointments", TABLE.appointments.toDb(r))),
            ...SEED_ORDERS.map(r => sb.upsert("orders", TABLE.orders.toDb(r))),
            ...SEED_INVENTORY.map(r => sb.upsert("inventory", TABLE.inventory.toDb(r))),
            ...SEED_ACCOUNTING.map(r => sb.upsert("accounting", TABLE.accounting.toDb(r))),
            ...SEED_LIBRARY.map(r => sb.upsert("library", TABLE.library.toDb(r))),
            ...SERVICES_CAT.map(r => sb.upsert("services", TABLE.services.toDb(r))),
          ]);
          const seeded = await loadAll();
          setData(seeded);
        } else {
          setData(loaded);
        }
        setDbReady(true);
      } catch(e) {
        console.error("Supabase error:", e);
        setDbReady(false);
        // Fallback to seed data if DB unreachable
        setData({ clients:SEED_CLIENTS, vehicles:SEED_VEHICLES, appointments:SEED_APPTS, orders:SEED_ORDERS, workers:SEED_WORKERS, suppliers:SEED_SUPPLIERS, inventory:SEED_INVENTORY, accounting:SEED_ACCOUNTING, library:SEED_LIBRARY, services:SERVICES_CAT, subcontracts:[], quotes:[] });
      }
    })();
  }, []);

  /* ── Save: upsert changed records then reload collection ── */
  const save = useCallback(async (patch) => {
    setData(prev => ({ ...prev, ...patch }));
    for (const [key, list] of Object.entries(patch)) {
      const cfg = TABLE[key];
      if (!cfg || !Array.isArray(list)) continue;
      try {
        // Get current DB ids for this table
        const dbRows = await sb.get(cfg.table);
        const dbIds  = new Set((dbRows||[]).map(r=>r.id));
        const appIds = new Set(list.map(r=>r.id));
        // Delete removed rows
        for (const id of dbIds) { if (!appIds.has(id)) await sb.delete(cfg.table, id); }
        // Upsert all current rows
        for (const row of list) { await sb.upsert(cfg.table, cfg.toDb(row)); }
      } catch(e) { console.error(`Error saving ${key}:`, e); }
    }
  }, []);

  const showToast = (msg, type="ok") => {
    setToast({ msg, type });
    setTimeout(()=>setToast(null), 3000);
  };

  if (!data) return <Loader />;

  const navItem = NAV.find(n=>n.id===page);
  const dbBanner = !dbReady;

  return (
    <div style={{ display:"flex", height:"100vh", background:C.bg, color:C.text, fontFamily:"'Inter',system-ui,sans-serif", overflow:"hidden" }}>
      {/* SIDEBAR */}
      <Sidebar page={page} setPage={setPage} open={sideOpen} setOpen={setSideOpen} />

      {/* MAIN */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Topbar */}
        <div style={{ height:56, borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", padding:"0 24px", gap:16, flexShrink:0, background:C.surface }}>
          <button onClick={()=>setSideOpen(o=>!o)} style={{ background:"none", border:"none", color:C.textMd, cursor:"pointer", fontSize:20, padding:4 }}>☰</button>
          <div style={{ flex:1 }}>
            <span style={{ fontWeight:700, fontSize:16 }}>{navItem?.label}</span>
          </div>
          <span style={{ fontSize:12, color:C.textSm }}>{todayLabel()}</span>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginLeft:16 }}>
            <span style={{ fontSize:12, color:C.textSm, background:C.card, border:`1px solid ${C.border}`, borderRadius:20, padding:"4px 12px" }}>👤 {session.email}</span>
            <button onClick={onLogout} style={{ fontSize:12, color:C.red, background:"none", border:`1px solid ${C.red}44`, borderRadius:8, padding:"5px 12px", cursor:"pointer", fontWeight:600 }}>Salir</button>
          </div>
        </div>

        {/* DB status banner */}
        {dbBanner && (
          <div style={{ background:"#2D1000", borderBottom:`1px solid ${C.red}44`, padding:"8px 24px", fontSize:12, color:C.amber, display:"flex", alignItems:"center", gap:8 }}>
            ⚠️ <strong>Modo sin conexión:</strong> Los datos se guardan localmente. Verificá tu conexión a Supabase.
          </div>
        )}
        {dbReady && (
          <div style={{ background:"#001A0A", borderBottom:`1px solid ${C.green}22`, padding:"6px 24px", fontSize:11, color:C.green, display:"flex", alignItems:"center", gap:6 }}>
            🟢 Conectado a Supabase · Datos en tiempo real
          </div>
        )}

        {/* Page content */}
        <div style={{ flex:1, overflowY:"auto", padding:"28px 28px" }}>
          {page==="dashboard"    ? <Dashboard      data={data} setPage={setPage} />
          : page==="clients"     ? <ClientsPage    data={data} save={save} toast={showToast} />
          : page==="vehicles"    ? <VehiclesPage   data={data} save={save} toast={showToast} />
          : page==="appointments"? <ApptsPage      data={data} save={save} toast={showToast} />
          : page==="orders"      ? <OrdersPage     data={data} save={save} toast={showToast} />
          : page==="services"    ? <ServicesPage data={data} save={save} toast={showToast} />
          : page==="workers"     ? <WorkersPage    data={data} save={save} toast={showToast} />
          : page==="metrics"     ? <MetricsPage    data={data} />
          : page==="inventory"   ? <InventoryPage  data={data} save={save} toast={showToast} />
          : page==="suppliers"   ? <SuppliersPage  data={data} save={save} toast={showToast} />
          : page==="accounting"  ? <AccountingPage data={data} save={save} toast={showToast} />
          : page==="library"     ? <LibraryPage    data={data} save={save} toast={showToast} />
          : page==="intake"      ? <IntakePage     data={data} save={save} toast={showToast} />
          : page==="ai_diag"     ? <AIDiagPage     data={data} />
          : page==="ai_quote"    ? <AIQuotePage    data={data} />
          : page==="ai_manual"   ? <AIManualPage   data={data} />
          : page==="users"       ? <UsersPage      session={session} />
          : page==="subcontracts"? <SubcontractsPage data={data} save={save} toast={showToast} />
          : page==="quotes"      ? <QuotesPage      data={data} save={save} toast={showToast} />
          : null}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:28, right:28, background: toast.type==="ok"?C.green:C.red, color:"#fff", borderRadius:10, padding:"12px 20px", fontWeight:600, fontSize:14, boxShadow:"0 8px 30px rgba(0,0,0,.4)", zIndex:9999, animation:"fadeIn .2s" }}>
          {toast.type==="ok"?"✅":"❌"} {toast.msg}
        </div>
      )}
      <style>{`* { box-sizing:border-box; } ::-webkit-scrollbar{width:6px;} ::-webkit-scrollbar-track{background:${C.bg};} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px;} @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

/* ─── SIDEBAR ─── */
function Sidebar({ page, setPage, open, setOpen }) {
  const groups = [...new Set(NAV.map(n=>n.group))];
  return (
    <div style={{ width: open?220:64, background:C.surface, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", flexShrink:0, transition:"width .2s", overflow:"hidden" }}>
      {/* Logo */}
      <div style={{ padding:"16px 14px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:10, minHeight:56 }}>
        <div style={{ width:32, height:32, background:`linear-gradient(135deg,${C.blue},${C.cyan})`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>🔧</div>
        {open && <div style={{ lineHeight:1.2 }}>
          <div style={{ fontWeight:800, fontSize:13, whiteSpace:"nowrap" }}>Tecno Auto<span style={{ color:C.blueHi }}>CR</span></div>
          <div style={{ fontSize:10, color:C.textSm }}>Sistema de Gestión</div>
        </div>}
      </div>

      <div style={{ flex:1, overflowY:"auto", padding:"10px 8px" }}>
        {groups.map(g => (
          <div key={g} style={{ marginBottom:4 }}>
            {open && <div style={{ fontSize:10, fontWeight:700, color:C.textSm, textTransform:"uppercase", letterSpacing:1, padding:"10px 8px 4px" }}>{GROUPS[g]}</div>}
            {NAV.filter(n=>n.group===g).map(n => {
              const active = page===n.id;
              return (
                <button key={n.id} onClick={()=>setPage(n.id)} title={n.label}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"9px 10px", borderRadius:8, border:"none", cursor:"pointer", background: active?`${C.blue}22`:"transparent", color: active?C.blueHi : n.stub?C.textSm:C.textMd, fontWeight: active?700:400, fontSize:13, marginBottom:2, textAlign:"left", transition:"all .1s" }}>
                  <span style={{ fontSize:15, flexShrink:0, opacity: n.stub?.5:1 }}>{n.icon}</span>
                  {open && <span style={{ whiteSpace:"nowrap", opacity:n.stub?.6:1 }}>{n.label}{n.stub?" ·":""}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── LOADER ─── */
function Loader() {
  return <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.bg, color:C.textMd, fontSize:16 }}>Cargando sistema…</div>;
}

/* ─── STUB ─── */
function StubPage({ label, icon }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:400, gap:16, color:C.textSm }}>
      <div style={{ fontSize:56 }}>{icon}</div>
      <div style={{ fontSize:22, fontWeight:700, color:C.textMd }}>{label}</div>
      <div style={{ fontSize:14 }}>Este módulo estará disponible en la próxima versión.</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════ */
function Dashboard({ data, setPage }) {
  const { clients, appointments, orders, vehicles } = data;

  const todayAppts  = appointments.filter(a=>a.date===today());
  const pendingAppts= appointments.filter(a=>a.status==="pending");
  const activeOrders= orders.filter(o=>o.status==="active");

  // income this month
  const thisMonth = new Date().toISOString().slice(0,7);
  const monthIncome= orders.filter(o=>o.date?.startsWith(thisMonth)&&o.status==="completed").reduce((s,o)=>s+o.total,0);

  // health score
  const issues = pendingAppts.length>5 || activeOrders.length>3;
  const healthLabel = issues ? "Revisar carga" : "Al día ✓";
  const healthColor = issues ? C.amber : C.green;

  // upcoming appointments (next 3)
  const upcoming = [...appointments].filter(a=>a.date>=today()&&a.status!=="cancelled").sort((a,b)=>a.date.localeCompare(b.date)||a.hour.localeCompare(b.hour)).slice(0,4);

  const kpis = [
    { label:"Estado del taller",    value:healthLabel,          color:healthColor, icon:"⚡", sub:"Hoy" },
    { label:"Citas hoy",            value:todayAppts.length,    color:C.blueHi,   icon:"📅", sub:`${pendingAppts.length} pendientes` },
    { label:"Órdenes activas",      value:activeOrders.length,  color:C.amber,    icon:"🔧", sub:"En proceso" },
    { label:"Ingresos del mes",     value:fmtCRC(monthIncome),  color:C.green,    icon:"💰", sub:new Date().toLocaleDateString("es-CR",{month:"long"}) },
    { label:"Clientes registrados", value:clients.length,       color:C.purple,   icon:"👤", sub:`${vehicles.length} vehículos` },
  ];

  return (
    <div>
      {/* greeting */}
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:22, fontWeight:800 }}>Buenos días, Tecno AutoAsisten CR 👋</div>
        <div style={{ color:C.textMd, fontSize:14, marginTop:4 }}>{todayLabel()}</div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:14, marginBottom:28 }}>
        {kpis.map(k=>(
          <div key={k.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"18px 20px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:11, color:C.textSm, fontWeight:600, textTransform:"uppercase", letterSpacing:.8 }}>{k.label}</div>
                <div style={{ fontSize:24, fontWeight:800, color:k.color, marginTop:6, lineHeight:1 }}>{k.value}</div>
                <div style={{ fontSize:11, color:C.textSm, marginTop:4 }}>{k.sub}</div>
              </div>
              <span style={{ fontSize:22 }}>{k.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        {/* Upcoming appointments */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 22px" }}>
          <div style={{ fontWeight:700, marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span>Próximas citas</span>
            <button onClick={()=>setPage("appointments")} style={{ fontSize:12, color:C.blueHi, background:"none", border:"none", cursor:"pointer" }}>Ver todas →</button>
          </div>
          {upcoming.length===0 && <Empty msg="No hay citas próximas" />}
          {upcoming.map(a=>{
            const client = data.clients.find(c=>c.id===a.clientId);
            const vehicle= data.vehicles.find(v=>v.id===a.vehicleId);
            const svc    = (data.services||SERVICES_CAT).find(s=>s.id===a.serviceId);
            const sc     = STATUS_COLORS[a.status];
            return (
              <div key={a.id} style={{ display:"flex", gap:14, alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ background:C.bg, borderRadius:8, padding:"6px 10px", textAlign:"center", minWidth:52, flexShrink:0 }}>
                  <div style={{ fontSize:10, color:C.textSm }}>{a.date.slice(5).replace("-","/")}</div>
                  <div style={{ fontWeight:700, color:C.blueHi, fontSize:13 }}>{a.hour}</div>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{client?.name||"—"}</div>
                  <div style={{ fontSize:11, color:C.textSm }}>{vehicle?.plate} · {svc?.name}</div>
                </div>
                <Pill label={sc?.label} color={sc?.color} bg={sc?.bg} />
              </div>
            );
          })}
        </div>

        {/* Active orders */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 22px" }}>
          <div style={{ fontWeight:700, marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span>Órdenes activas</span>
            <button onClick={()=>setPage("orders")} style={{ fontSize:12, color:C.blueHi, background:"none", border:"none", cursor:"pointer" }}>Ver todas →</button>
          </div>
          {activeOrders.length===0 && <Empty msg="Sin órdenes activas" />}
          {activeOrders.map(o=>{
            const client = data.clients.find(c=>c.id===o.clientId);
            const vehicle= data.vehicles.find(v=>v.id===o.vehicleId);
            return (
              <div key={o.id} style={{ padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <div style={{ fontWeight:600, fontSize:13 }}>{client?.name||"—"} · {vehicle?.plate}</div>
                  <div style={{ fontWeight:700, color:C.green, fontSize:13 }}>{fmtCRC(o.total)}</div>
                </div>
                <div style={{ fontSize:11, color:C.textSm, marginTop:2 }}>{o.mechanic} · {fmtDate(o.date)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CLIENTS PAGE
═══════════════════════════════════════════════════ */
function ClientsPage({ data, save, toast }) {
  const [search, setSearch] = useState("");
  const [modal, setModal]   = useState(null); // null | {mode:"new"|"edit", item}
  const [delId,  setDelId]  = useState(null);

  const filtered = data.clients.filter(c=>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || c.idNum?.includes(search)
  );

  const upsert = (item) => {
    const list = item.id
      ? data.clients.map(c=>c.id===item.id?item:c)
      : [...data.clients, { ...item, id:uid() }];
    save({ clients:list });
    toast(item.id?"Cliente actualizado":"Cliente creado");
    setModal(null);
  };

  const del = (id) => {
    save({ clients:data.clients.filter(c=>c.id!==id) });
    toast("Cliente eliminado","err");
    setDelId(null);
  };

  const clientVehicles = (cid) => data.vehicles.filter(v=>v.clientId===cid);
  const clientOrders   = (cid) => data.orders.filter(o=>o.clientId===cid);

  return (
    <div>
      <PageHeader title={`Clientes (${data.clients.length})`} onNew={()=>setModal({mode:"new",item:{name:"",phone:"",email:"",idNum:"",notes:""}})} />
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre, teléfono o cédula…" />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:14, marginTop:16 }}>
        {filtered.map(c=>(
          <div key={c.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 20px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>{c.name}</div>
                <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>{c.phone} {c.email && `· ${c.email}`}</div>
                {c.idNum && <div style={{ fontSize:11, color:C.textSm, marginTop:1 }}>Cédula: {c.idNum}</div>}
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <IBtn icon="✏️" onClick={()=>setModal({mode:"edit",item:c})} />
                <IBtn icon="🗑" red onClick={()=>setDelId(c.id)} />
              </div>
            </div>
            <div style={{ display:"flex", gap:12, marginTop:14 }}>
              <Stat label="Vehículos" value={clientVehicles(c.id).length} />
              <Stat label="Órdenes"   value={clientOrders(c.id).length} />
              <Stat label="Gasto total" value={fmtCRC(clientOrders(c.id).reduce((s,o)=>s+o.total,0))} />
            </div>
            {c.notes && <div style={{ marginTop:10, fontSize:12, color:C.textSm, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>💬 {c.notes}</div>}
          </div>
        ))}
        {filtered.length===0 && <Empty msg="No se encontraron clientes" />}
      </div>

      {modal && <ClientModal item={modal.item} onSave={upsert} onClose={()=>setModal(null)} />}
      {delId  && <Confirm msg="¿Eliminar este cliente?" onOk={()=>del(delId)} onCancel={()=>setDelId(null)} />}
    </div>
  );
}

function ClientModal({ item, onSave, onClose }) {
  const [f, setF] = useState(item);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  return (
    <Modal title={item.id?"Editar cliente":"Nuevo cliente"} onClose={onClose}>
      <Grid2>
        <Field label="Nombre completo"><input value={f.name}  onChange={e=>set("name",e.target.value)}  style={IS()} /></Field>
        <Field label="Teléfono">       <input value={f.phone} onChange={e=>set("phone",e.target.value)} style={IS()} /></Field>
        <Field label="Correo">         <input value={f.email} onChange={e=>set("email",e.target.value)} style={IS()} /></Field>
        <Field label="Cédula / ID">    <input value={f.idNum} onChange={e=>set("idNum",e.target.value)} style={IS()} /></Field>
      </Grid2>
      <Field label="Notas"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{...IS(),resize:"vertical"}} /></Field>
      <ModalActions onSave={()=>onSave(f)} onClose={onClose} />
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   VEHICLES PAGE
═══════════════════════════════════════════════════ */
function VehiclesPage({ data, save, toast }) {
  const [search, setSearch] = useState("");
  const [modal, setModal]   = useState(null);
  const [delId,  setDelId]  = useState(null);

  const filtered = data.vehicles.filter(v=>{
    if (!search) return true;
    const q = search.toLowerCase();
    const c = data.clients.find(cl=>cl.id===v.clientId);
    return v.plate.toLowerCase().includes(q)||v.brand.toLowerCase().includes(q)||v.model.toLowerCase().includes(q)||(c?.name.toLowerCase().includes(q));
  });

  const upsert = (item) => {
    const list = item.id
      ? data.vehicles.map(v=>v.id===item.id?item:v)
      : [...data.vehicles, { ...item, id:uid() }];
    save({ vehicles:list });
    toast(item.id?"Vehículo actualizado":"Vehículo registrado");
    setModal(null);
  };

  const del = (id) => { save({ vehicles:data.vehicles.filter(v=>v.id!==id) }); toast("Eliminado","err"); setDelId(null); };

  return (
    <div>
      <PageHeader title={`Vehículos (${data.vehicles.length})`} onNew={()=>setModal({mode:"new",item:{clientId:data.clients[0]?.id||"",plate:"",brand:"",model:"",year:new Date().getFullYear(),color:"",vin:"",km:0,fuel:"Gasolina",notes:""}})} />
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar por placa, marca, modelo o cliente…" />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:14, marginTop:16 }}>
        {filtered.map(v=>{
          const client = data.clients.find(c=>c.id===v.clientId);
          return (
            <div key={v.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 20px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontWeight:700, fontSize:16 }}>{v.plate}</span>
                    <span style={{ background:C.border, borderRadius:4, padding:"2px 8px", fontSize:11, color:C.textMd }}>{v.fuel}</span>
                  </div>
                  <div style={{ fontWeight:600, fontSize:14, marginTop:3 }}>{v.year} {v.brand} {v.model}</div>
                  <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>👤 {client?.name||"Sin cliente"} · {v.color}</div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <IBtn icon="✏️" onClick={()=>setModal({mode:"edit",item:v})} />
                  <IBtn icon="🗑" red onClick={()=>setDelId(v.id)} />
                </div>
              </div>
              <div style={{ display:"flex", gap:12, marginTop:14 }}>
                <Stat label="Kilometraje" value={`${Number(v.km||0).toLocaleString()} km`} />
                {v.vin && <Stat label="VIN" value={v.vin.slice(-6)} />}
              </div>
              {v.notes && <div style={{ marginTop:10, fontSize:12, color:C.textSm, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>💬 {v.notes}</div>}
            </div>
          );
        })}
        {filtered.length===0 && <Empty msg="No se encontraron vehículos" />}
      </div>

      {modal && <VehicleModal item={modal.item} clients={data.clients} onSave={upsert} onClose={()=>setModal(null)} />}
      {delId  && <Confirm msg="¿Eliminar este vehículo?" onOk={()=>del(delId)} onCancel={()=>setDelId(null)} />}
    </div>
  );
}

function VehicleModal({ item, clients, onSave, onClose }) {
  const [f, setF] = useState(item);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const FUELS = ["Gasolina","Diésel","Híbrido","Eléctrico"];
  return (
    <Modal title={item.id?"Editar vehículo":"Registrar vehículo"} onClose={onClose}>
      <Grid2>
        <Field label="Cliente">
          <select value={f.clientId} onChange={e=>set("clientId",e.target.value)} style={IS()}>
            {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Placa"><input value={f.plate} onChange={e=>set("plate",e.target.value.toUpperCase())} style={IS()} placeholder="ABC-123" /></Field>
        <Field label="Marca"><input value={f.brand} onChange={e=>set("brand",e.target.value)} style={IS()} /></Field>
        <Field label="Modelo"><input value={f.model} onChange={e=>set("model",e.target.value)} style={IS()} /></Field>
        <Field label="Año"><input type="number" value={f.year} onChange={e=>set("year",+e.target.value)} style={IS()} /></Field>
        <Field label="Color"><input value={f.color} onChange={e=>set("color",e.target.value)} style={IS()} /></Field>
        <Field label="Kilometraje"><input type="number" value={f.km} onChange={e=>set("km",+e.target.value)} style={IS()} /></Field>
        <Field label="Combustible">
          <select value={f.fuel} onChange={e=>set("fuel",e.target.value)} style={IS()}>
            {FUELS.map(fu=><option key={fu}>{fu}</option>)}
          </select>
        </Field>
      </Grid2>
      <Field label="VIN / Chasis"><input value={f.vin} onChange={e=>set("vin",e.target.value.toUpperCase())} style={IS()} /></Field>
      <Field label="Notas"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{...IS(),resize:"vertical"}} /></Field>
      <ModalActions onSave={()=>onSave(f)} onClose={onClose} />
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   APPOINTMENTS PAGE
═══════════════════════════════════════════════════ */
const STATUS_COLORS = {
  pending:   { label:"Pendiente",  color:"#F59E0B", bg:"#2D2000" },
  confirmed: { label:"Confirmada", color:"#10B981", bg:"#002D1A" },
  cancelled: { label:"Cancelada",  color:"#EF4444", bg:"#2D0000" },
  done:      { label:"Completada", color:"#8B5CF6", bg:"#1A0A2D" },
};

function ApptsPage({ data, save, toast }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [modal,  setModal]  = useState(null);
  const [delId,  setDelId]  = useState(null);

  const sorted = [...data.appointments].sort((a,b)=>a.date.localeCompare(b.date)||a.hour.localeCompare(b.hour));
  const filtered = sorted.filter(a=>{
    const matchS = filter==="all"||a.status===filter;
    const q = search.toLowerCase();
    const c = data.clients.find(cl=>cl.id===a.clientId);
    const v = data.vehicles.find(vv=>vv.id===a.vehicleId);
    return matchS && (!q||c?.name.toLowerCase().includes(q)||v?.plate.toLowerCase().includes(q));
  });

  const upsert = (item) => {
    const list = item.id
      ? data.appointments.map(a=>a.id===item.id?item:a)
      : [...data.appointments, { ...item, id:uid() }];
    save({ appointments:list });
    toast(item.id?"Cita actualizada":"Cita agendada");
    setModal(null);
  };

  const del = (id) => { save({ appointments:data.appointments.filter(a=>a.id!==id) }); toast("Eliminada","err"); setDelId(null); };
  const upd = (id, patch) => { save({ appointments:data.appointments.map(a=>a.id===id?{...a,...patch}:a) }); toast("Estado actualizado"); };

  const newDefault = { clientId:data.clients[0]?.id||"", vehicleId:data.vehicles[0]?.id||"", serviceId:"diag", date:today(), hour:"9:00", status:"pending", notes:"", mechanic:data.workers[0]?.name||"" };

  return (
    <div>
      <PageHeader title={`Citas (${data.appointments.length})`} onNew={()=>setModal({mode:"new",item:newDefault})} newLabel="+ Nueva cita" />
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por cliente o placa…" style={{ flex:1 }} />
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={{...IS(), padding:"9px 14px", minWidth:160}}>
          <option value="all">Todos los estados</option>
          {Object.entries(STATUS_COLORS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {filtered.map(a=>{
          const client  = data.clients.find(c=>c.id===a.clientId);
          const vehicle = data.vehicles.find(v=>v.id===a.vehicleId);
          const svc     = (data.services||SERVICES_CAT).find(s=>s.id===a.serviceId);
          const sc      = STATUS_COLORS[a.status];
          return (
            <div key={a.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px", display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
              <div style={{ background:C.bg, borderRadius:8, padding:"7px 12px", textAlign:"center", minWidth:58, flexShrink:0 }}>
                <div style={{ fontSize:10, color:C.textSm }}>{fmtDate(a.date)}</div>
                <div style={{ fontWeight:700, color:C.blueHi, fontSize:15 }}>{a.hour}</div>
              </div>
              <div style={{ flex:1, minWidth:160 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{client?.name||"—"} <span style={{ color:C.textSm, fontWeight:400, fontSize:12 }}>· {vehicle?.plate}</span></div>
                <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>{svc?.name} · {a.mechanic}</div>
                {a.notes && <div style={{ fontSize:11, color:C.textSm }}>💬 {a.notes}</div>}
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                <Pill label={sc?.label} color={sc?.color} bg={sc?.bg} />
                {a.status==="pending"   && <TBtn label="Confirmar" color={C.green}  onClick={()=>upd(a.id,{status:"confirmed"})} />}
                {a.status==="confirmed" && <TBtn label="Completar" color={C.purple} onClick={()=>upd(a.id,{status:"done"})} />}
                {a.status!=="cancelled"&&a.status!=="done" && <TBtn label="Cancelar" color={C.red} onClick={()=>upd(a.id,{status:"cancelled"})} />}
                <IBtn icon="✏️" onClick={()=>setModal({mode:"edit",item:a})} />
                <IBtn icon="🗑" red onClick={()=>setDelId(a.id)} />
              </div>
            </div>
          );
        })}
        {filtered.length===0 && <Empty msg="No hay citas que coincidan" />}
      </div>

      {modal && <ApptModal item={modal.item} data={data} onSave={upsert} onClose={()=>setModal(null)} />}
      {delId  && <Confirm msg="¿Eliminar esta cita?" onOk={()=>del(delId)} onCancel={()=>setDelId(null)} />}
    </div>
  );
}

function ApptModal({ item, data, onSave, onClose }) {
  const [f, setF] = useState(item);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const clientVehicles = data.vehicles.filter(v=>v.clientId===f.clientId);
  return (
    <Modal title={item.id?"Editar cita":"Nueva cita"} onClose={onClose}>
      <Grid2>
        <Field label="Cliente">
          <select value={f.clientId} onChange={e=>{ set("clientId",e.target.value); set("vehicleId",data.vehicles.find(v=>v.clientId===e.target.value)?.id||""); }} style={IS()}>
            {data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Vehículo">
          <select value={f.vehicleId} onChange={e=>set("vehicleId",e.target.value)} style={IS()}>
            {clientVehicles.map(v=><option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}
          </select>
        </Field>
        <Field label="Servicio">
          <select value={f.serviceId} onChange={e=>set("serviceId",e.target.value)} style={IS()}>
            {(data.services||SERVICES_CAT).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Mecánico">
          <select value={f.mechanic} onChange={e=>set("mechanic",e.target.value)} style={IS()}>
            {data.workers.filter(w=>w.status==="active").map(w=><option key={w.id} value={w.name}>{w.name}</option>)}
          </select>
        </Field>
        <Field label="Fecha"><input type="date" value={f.date} min={today()} onChange={e=>set("date",e.target.value)} style={IS()} /></Field>
        <Field label="Hora">
          <select value={f.hour} onChange={e=>set("hour",e.target.value)} style={IS()}>
            {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select value={f.status} onChange={e=>set("status",e.target.value)} style={IS()}>
            {Object.entries(STATUS_COLORS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
      </Grid2>
      <Field label="Notas"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{...IS(),resize:"vertical"}} /></Field>
      <ModalActions onSave={()=>onSave(f)} onClose={onClose} />
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   ORDERS PAGE
═══════════════════════════════════════════════════ */
const ORDER_STATUS = {
  active:    { label:"Activa",     color:"#F59E0B", bg:"#2D2000" },
  completed: { label:"Completada", color:"#10B981", bg:"#002D1A" },
  cancelled: { label:"Cancelada",  color:"#EF4444", bg:"#2D0000" },
};

function OrdersPage({ data, save, toast }) {
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [delId,  setDelId]  = useState(null);
  const [filter, setFilter] = useState("all");

  const filtered = data.orders.filter(o=>filter==="all"||o.status===filter);

  const upsert = (item) => {
    const total = item.services.reduce((s,sid)=>s+((data.services||SERVICES_CAT).find(x=>x.id===sid)?.price||0),0)
                + item.parts.reduce((s,p)=>s+(p.price*p.qty),0);
    const final = { ...item, total };
    const list  = item.id ? data.orders.map(o=>o.id===item.id?final:o) : [...data.orders,{...final,id:uid()}];
    save({ orders:list });
    toast(item.id?"Orden actualizada":"Orden creada");
    setModal(null);
  };

  const upd = (id,patch) => { save({ orders:data.orders.map(o=>o.id===id?{...o,...patch}:o) }); toast("Estado actualizado"); };
  const del = (id) => { save({ orders:data.orders.filter(o=>o.id!==id) }); toast("Eliminada","err"); setDelId(null); };

  const newDefault = { clientId:data.clients[0]?.id||"", vehicleId:data.vehicles[0]?.id||"", services:[], parts:[], status:"active", date:today(), notes:"", mechanic:data.workers[0]?.name||"", total:0 };

  return (
    <div>
      <PageHeader title={`Órdenes de trabajo (${data.orders.length})`} onNew={()=>setModal({mode:"new",item:newDefault})} />
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[["all","Todas"],["active","Activas"],["completed","Completadas"],["cancelled","Canceladas"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${filter===v?C.blueHi:C.border}`, background:filter===v?`${C.blue}22`:"transparent", color:filter===v?C.blueHi:C.textMd, cursor:"pointer", fontSize:13, fontWeight:filter===v?700:400 }}>{l}</button>
        ))}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {filtered.map(o=>{
          const client  = data.clients.find(c=>c.id===o.clientId);
          const vehicle = data.vehicles.find(v=>v.id===o.vehicleId);
          const sc      = ORDER_STATUS[o.status];
          return (
            <div key={o.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px" }}>
              <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ fontWeight:700, fontSize:15 }}>{client?.name||"—"} <span style={{ fontWeight:400, color:C.textSm, fontSize:13 }}>· {vehicle?.plate}</span></div>
                  <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>{o.mechanic} · {fmtDate(o.date)}</div>
                  <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>{o.services.map(sid=>(data.services||SERVICES_CAT).find(s=>s.id===sid)?.name).join(", ")}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:800, fontSize:18, color:C.green }}>{fmtCRC(o.total)}</div>
                  <Pill label={sc?.label} color={sc?.color} bg={sc?.bg} />
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <TBtn label="Ver" color={C.blueHi} onClick={()=>setDetail(o)} />
                  {o.status==="active" && <TBtn label="Completar" color={C.green} onClick={()=>upd(o.id,{status:"completed"})} />}
                  <IBtn icon="✏️" onClick={()=>setModal({mode:"edit",item:o})} />
                  <IBtn icon="🗑" red onClick={()=>setDelId(o.id)} />
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length===0 && <Empty msg="No hay órdenes" />}
      </div>

      {modal  && <OrderModal item={modal.item} data={data} onSave={upsert} onClose={()=>setModal(null)} />}
      {detail && <OrderDetail order={detail} data={data} onClose={()=>setDetail(null)} />}
      {delId  && <Confirm msg="¿Eliminar esta orden?" onOk={()=>del(delId)} onCancel={()=>setDelId(null)} />}
    </div>
  );
}

function OrderModal({ item, data, onSave, onClose }) {
  const [f, setF] = useState({ ...item, services:[...item.services], parts:item.parts.map(p=>({...p})) });
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const toggleSvc = (id) => setF(p=>({ ...p, services: p.services.includes(id)?p.services.filter(s=>s!==id):[...p.services,id] }));
  const addPart = () => setF(p=>({ ...p, parts:[...p.parts,{name:"",qty:1,price:0}] }));
  const setPart = (i,k,v) => setF(p=>{ const parts=[...p.parts]; parts[i]={...parts[i],[k]:v}; return {...p,parts}; });
  const remPart = (i) => setF(p=>({ ...p, parts:p.parts.filter((_,ii)=>ii!==i) }));
  const clientVehicles = data.vehicles.filter(v=>v.clientId===f.clientId);
  const preview = f.services.reduce((s,sid)=>s+((data.services||SERVICES_CAT).find(x=>x.id===sid)?.price||0),0) + f.parts.reduce((s,p)=>s+(+p.price * +p.qty),0);

  return (
    <Modal title={item.id?"Editar orden":"Nueva orden de trabajo"} onClose={onClose} wide>
      <Grid2>
        <Field label="Cliente">
          <select value={f.clientId} onChange={e=>{ set("clientId",e.target.value); set("vehicleId",data.vehicles.find(v=>v.clientId===e.target.value)?.id||""); }} style={IS()}>
            {data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Vehículo">
          <select value={f.vehicleId} onChange={e=>set("vehicleId",e.target.value)} style={IS()}>
            {clientVehicles.map(v=><option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}
          </select>
        </Field>
        <Field label="Mecánico">
          <select value={f.mechanic} onChange={e=>set("mechanic",e.target.value)} style={IS()}>
            {data.workers.filter(w=>w.status==="active").map(w=><option key={w.id} value={w.name}>{w.name}</option>)}
          </select>
        </Field>
        <Field label="Fecha"><input type="date" value={f.date} onChange={e=>set("date",e.target.value)} style={IS()} /></Field>
      </Grid2>

      <Field label="Servicios incluidos">
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:4 }}>
          {(data.services||SERVICES_CAT).map(s=>{
            const sel = f.services.includes(s.id);
            return <button key={s.id} onClick={()=>toggleSvc(s.id)} style={{ padding:"6px 12px", borderRadius:7, border:`1px solid ${sel?C.blueHi:C.border}`, background:sel?`${C.blue}22`:"transparent", color:sel?C.blueHi:C.textMd, cursor:"pointer", fontSize:12, fontWeight:sel?700:400 }}>{s.name}</button>;
          })}
        </div>
      </Field>

      <div style={{ marginTop:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <label style={{ fontSize:12, fontWeight:600, color:C.textSm }}>Repuestos / Materiales</label>
          <button onClick={addPart} style={{ fontSize:12, color:C.blueHi, background:"none", border:"none", cursor:"pointer" }}>+ Agregar</button>
        </div>
        {f.parts.map((p,i)=>(
          <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 80px 120px 32px", gap:8, marginBottom:6 }}>
            <input placeholder="Descripción" value={p.name} onChange={e=>setPart(i,"name",e.target.value)} style={IS()} />
            <input type="number" placeholder="Cant." value={p.qty} onChange={e=>setPart(i,"qty",e.target.value)} style={IS()} />
            <input type="number" placeholder="Precio ₡" value={p.price} onChange={e=>setPart(i,"price",e.target.value)} style={IS()} />
            <button onClick={()=>remPart(i)} style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:16 }}>✕</button>
          </div>
        ))}
      </div>

      <Field label="Notas"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{...IS(),resize:"vertical"}} /></Field>

      <div style={{ background:C.bg, borderRadius:10, padding:"12px 16px", marginTop:14, display:"flex", justifyContent:"space-between" }}>
        <span style={{ color:C.textMd, fontSize:14 }}>Total estimado</span>
        <span style={{ fontWeight:800, fontSize:18, color:C.green }}>{fmtCRC(preview)}</span>
      </div>
      <ModalActions onSave={()=>onSave(f)} onClose={onClose} />
    </Modal>
  );
}

function OrderDetail({ order, data, onClose }) {
  const client  = data.clients.find(c=>c.id===order.clientId);
  const vehicle = data.vehicles.find(v=>v.id===order.vehicleId);
  return (
    <Modal title={`Orden de trabajo — ${client?.name}`} onClose={onClose}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
        <Stat label="Cliente"   value={client?.name||"—"} />
        <Stat label="Vehículo"  value={`${vehicle?.plate} ${vehicle?.brand} ${vehicle?.model}`} />
        <Stat label="Mecánico"  value={order.mechanic} />
        <Stat label="Fecha"     value={fmtDate(order.date)} />
      </div>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:600, color:C.textSm, marginBottom:6 }}>SERVICIOS</div>
        {order.services.map(sid=>{ const s=(data.services||SERVICES_CAT).find(x=>x.id===sid); return s?<div key={sid} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}><span>{s.name}</span><span style={{ color:C.green }}>{fmtCRC(s.price)}</span></div>:null; })}
      </div>
      {order.parts.length>0 && <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:600, color:C.textSm, marginBottom:6 }}>REPUESTOS</div>
        {order.parts.map((p,i)=><div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${C.border}`, fontSize:13 }}><span>{p.name} × {p.qty}</span><span style={{ color:C.green }}>{fmtCRC(p.price*p.qty)}</span></div>)}
      </div>}
      <div style={{ background:C.bg, borderRadius:10, padding:"12px 16px", display:"flex", justifyContent:"space-between" }}>
        <span style={{ color:C.textMd }}>Total</span>
        <span style={{ fontWeight:800, fontSize:20, color:C.green }}>{fmtCRC(order.total)}</span>
      </div>
      {order.notes && <div style={{ marginTop:12, fontSize:13, color:C.textSm }}>💬 {order.notes}</div>}
      <div style={{ marginTop:16, display:"flex", justifyContent:"flex-end" }}>
        <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:8, border:"none", background:C.border, color:C.text, cursor:"pointer", fontSize:14 }}>Cerrar</button>
      </div>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   SERVICES PAGE (catalogue)
═══════════════════════════════════════════════════ */
function ServicesPage({ data, save, toast }) {
  const [modal, setModal] = useState(null);
  const [delId, setDelId] = useState(null);
  const services = data.services || SERVICES_CAT;
  const cats = [...new Set(services.map(s=>s.cat))];

  const upsert = (item) => {
    const list = item.id
      ? services.map(s=>s.id===item.id?item:s)
      : [...services, { ...item, id:uid() }];
    save({ services:list });
    toast(item.id?"Servicio actualizado":"Servicio agregado");
    setModal(null);
  };

  const del = (id) => {
    save({ services: services.filter(s=>s.id!==id) });
    toast("Servicio eliminado","err");
    setDelId(null);
  };

  const CATS = ["Diagnóstico","Mantenimiento","Seguridad","Confort","Eléctrico","Motor","Suspensión","Carrocería","Otros"];

  return (
    <div>
      <PageHeader title="Catálogo de servicios" onNew={()=>setModal({mode:"new",item:{name:"",price:0,cat:"Mantenimiento"}})} newLabel="+ Nuevo servicio" />
      {services.length===0 && <Empty msg="No hay servicios registrados" />}
      {cats.map(cat=>(
        <div key={cat} style={{ marginBottom:24 }}>
          <div style={{ fontSize:12, fontWeight:700, color:C.textSm, textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>{cat}</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:12 }}>
            {services.filter(s=>s.cat===cat).map(s=>(
              <div key={s.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 16px", display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:14, fontWeight:600 }}>{s.name}</span>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ fontWeight:800, color:C.green }}>{fmtCRC(s.price)}</span>
                  <IBtn icon="✏️" onClick={()=>setModal({mode:"edit",item:s})} />
                  <IBtn icon="🗑" red onClick={()=>setDelId(s.id)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {modal && <ServiceModal item={modal.item} cats={CATS} onSave={upsert} onClose={()=>setModal(null)} />}
      {delId && <Confirm msg="¿Eliminar este servicio del catálogo?" onOk={()=>del(delId)} onCancel={()=>setDelId(null)} />}
    </div>
  );
}

function ServiceModal({ item, cats, onSave, onClose }) {
  const [f, setF] = useState(item);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  return (
    <Modal title={item.id?"Editar servicio":"Nuevo servicio"} onClose={onClose}>
      <Field label="Nombre del servicio"><input value={f.name} onChange={e=>set("name",e.target.value)} style={IS()} placeholder="Cambio de aceite" /></Field>
      <div style={{ marginTop:14 }}>
        <Grid2>
          <Field label="Precio (₡)"><input type="number" value={f.price} onChange={e=>set("price",+e.target.value)} style={IS()} /></Field>
          <Field label="Categoría">
            <select value={f.cat} onChange={e=>set("cat",e.target.value)} style={IS()}>
              {cats.map(c=><option key={c}>{c}</option>)}
            </select>
          </Field>
        </Grid2>
      </div>
      <ModalActions onSave={()=>onSave(f)} onClose={onClose} />
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   WORKERS PAGE
═══════════════════════════════════════════════════ */
function WorkersPage({ data, save, toast }) {
  const [modal, setModal] = useState(null);
  const [delId,  setDelId]  = useState(null);

  const upsert = (item) => {
    const list = item.id ? data.workers.map(w=>w.id===item.id?item:w) : [...data.workers,{...item,id:uid()}];
    save({ workers:list });
    toast(item.id?"Actualizado":"Trabajador registrado");
    setModal(null);
  };
  const del = (id) => { save({ workers:data.workers.filter(w=>w.id!==id) }); toast("Eliminado","err"); setDelId(null); };

  return (
    <div>
      <PageHeader title={`Equipo (${data.workers.length})`} onNew={()=>setModal({mode:"new",item:{name:"",role:"Mecánico",phone:"",specialty:"",status:"active"}})} />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:14 }}>
        {data.workers.map(w=>{
          const assignedOrders = data.orders.filter(o=>o.mechanic===w.name&&o.status==="active").length;
          return (
            <div key={w.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"20px 20px" }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <div>
                  <div style={{ width:44, height:44, borderRadius:"50%", background:`linear-gradient(135deg,${C.blue},${C.cyan})`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:18, color:"#fff", marginBottom:10 }}>
                    {w.name.charAt(0)}
                  </div>
                  <div style={{ fontWeight:700, fontSize:15 }}>{w.name}</div>
                  <div style={{ fontSize:13, color:C.blueHi, marginTop:2 }}>{w.role}</div>
                  <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>📱 {w.phone}</div>
                  {w.specialty && <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>⚙️ {w.specialty}</div>}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                  <Pill label={w.status==="active"?"Activo":"Inactivo"} color={w.status==="active"?C.green:C.textSm} bg={w.status==="active"?"#002D1A":C.border} />
                  <IBtn icon="✏️" onClick={()=>setModal({mode:"edit",item:w})} />
                  <IBtn icon="🗑" red onClick={()=>setDelId(w.id)} />
                </div>
              </div>
              <div style={{ marginTop:14, padding:"10px 0", borderTop:`1px solid ${C.border}` }}>
                <Stat label="Órdenes activas" value={assignedOrders} />
              </div>
            </div>
          );
        })}
      </div>
      {modal && <WorkerModal item={modal.item} onSave={upsert} onClose={()=>setModal(null)} />}
      {delId  && <Confirm msg="¿Eliminar este trabajador?" onOk={()=>del(delId)} onCancel={()=>setDelId(null)} />}
    </div>
  );
}

function WorkerModal({ item, onSave, onClose }) {
  const [f, setF] = useState(item);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const ROLES = ["Mecánico Senior","Mecánico","Eléctrico","Administrador","Recepcionista"];
  return (
    <Modal title={item.id?"Editar trabajador":"Nuevo trabajador"} onClose={onClose}>
      <Grid2>
        <Field label="Nombre completo"><input value={f.name} onChange={e=>set("name",e.target.value)} style={IS()} /></Field>
        <Field label="Teléfono"><input value={f.phone} onChange={e=>set("phone",e.target.value)} style={IS()} /></Field>
        <Field label="Rol">
          <select value={f.role} onChange={e=>set("role",e.target.value)} style={IS()}>
            {ROLES.map(r=><option key={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select value={f.status} onChange={e=>set("status",e.target.value)} style={IS()}>
            <option value="active">Activo</option><option value="inactive">Inactivo</option>
          </select>
        </Field>
      </Grid2>
      <Field label="Especialidad"><input value={f.specialty} onChange={e=>set("specialty",e.target.value)} style={IS()} placeholder="Motor, eléctrico, A/C…" /></Field>
      <ModalActions onSave={()=>onSave(f)} onClose={onClose} />
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   METRICS PAGE
═══════════════════════════════════════════════════ */
function MetricsPage({ data }) {
  const { appointments, orders, clients } = data;

  const completedOrders = orders.filter(o=>o.status==="completed");
  const totalRevenue = completedOrders.reduce((s,o)=>s+o.total,0);
  const avgOrderValue = completedOrders.length ? totalRevenue/completedOrders.length : 0;

  // Revenue by month (last 6)
  const monthly = (() => {
    const map = {};
    for (let i=5; i>=0; i--) {
      const dt = new Date(); dt.setMonth(dt.getMonth()-i);
      const key = dt.toISOString().slice(0,7);
      map[key] = 0;
    }
    completedOrders.forEach(o=>{ if(o.date&&map[o.date.slice(0,7)]!==undefined) map[o.date.slice(0,7)]+=o.total; });
    return Object.entries(map).map(([m,v])=>({ m:m.slice(5), v }));
  })();
  const maxM = Math.max(...monthly.map(x=>x.v),1);

  // Services demand
  const svcCount = {};
  appointments.forEach(a=>{ svcCount[a.serviceId]=(svcCount[a.serviceId]||0)+1; });
  const topSvcs = Object.entries(svcCount).sort((a,b)=>b[1]-a[1]).slice(0,5)
    .map(([id,c])=>({ name:(data.services||SERVICES_CAT).find(s=>s.id===id)?.name||id, c }));
  const maxSvc = Math.max(...topSvcs.map(x=>x.c),1);

  // Citas por día últimos 14 días
  const daily = (() => {
    const map = {};
    for (let i=13; i>=0; i--) { const dt=new Date(); dt.setDate(dt.getDate()-i); map[dt.toISOString().slice(0,10)]=0; }
    appointments.forEach(a=>{ if(map[a.date]!==undefined) map[a.date]++; });
    return Object.entries(map).map(([d,c])=>({d:d.slice(5),c}));
  })();
  const maxD = Math.max(...daily.map(x=>x.c),1);

  const statCards = [
    { label:"Ingresos totales",     value:fmtCRC(totalRevenue),     color:C.green  },
    { label:"Órdenes completadas",  value:completedOrders.length,   color:C.purple },
    { label:"Ticket promedio",      value:fmtCRC(avgOrderValue),    color:C.blueHi },
    { label:"Total clientes",       value:clients.length,           color:C.cyan   },
    { label:"Total citas",          value:appointments.length,      color:C.amber  },
    { label:"Tasa completadas",     value: appointments.length ? `${Math.round(appointments.filter(a=>a.status==="done").length/appointments.length*100)}%` : "—", color:C.green },
  ];

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:14, marginBottom:28 }}>
        {statCards.map(s=>(
          <div key={s.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 20px" }}>
            <div style={{ fontSize:11, color:C.textSm, fontWeight:600, textTransform:"uppercase", letterSpacing:.8 }}>{s.label}</div>
            <div style={{ fontSize:26, fontWeight:800, color:s.color, marginTop:6 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>
        {/* Monthly revenue bar chart */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"22px 24px" }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:20 }}>Ingresos por mes (₡)</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:10, height:140 }}>
            {monthly.map(({m,v})=>(
              <div key={m} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                <div style={{ fontSize:10, color:C.textSm }}>{v>0?`${Math.round(v/1000)}k`:""}</div>
                <div style={{ width:"100%", background:`linear-gradient(180deg,${C.green},${C.cyan})`, borderRadius:"4px 4px 0 0", height:`${(v/maxM)*120}px`, minHeight:v?3:0 }} />
                <div style={{ fontSize:10, color:C.textSm }}>{m}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Service demand */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"22px 24px" }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:20 }}>Servicios más solicitados</div>
          {topSvcs.length===0 && <Empty msg="Sin datos" />}
          {topSvcs.map(({name,c},i)=>(
            <div key={name} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                <span style={{ color:C.text }}>{name}</span>
                <span style={{ color:C.textSm }}>{c}</span>
              </div>
              <div style={{ height:8, background:C.bg, borderRadius:4 }}>
                <div style={{ height:"100%", width:`${(c/maxSvc)*100}%`, background:[C.blueHi,C.cyan,C.green,C.purple,C.amber][i%5], borderRadius:4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily appointments */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"22px 24px" }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:20 }}>Citas — últimos 14 días</div>
        <div style={{ display:"flex", alignItems:"flex-end", gap:5, height:100 }}>
          {daily.map(({d,c})=>(
            <div key={d} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <div style={{ fontSize:9, color:C.textSm }}>{c||""}</div>
              <div style={{ width:"100%", background:`linear-gradient(180deg,${C.blueHi},${C.blue})`, borderRadius:"3px 3px 0 0", height:`${(c/maxD)*80}px`, minHeight:c?2:0 }} />
              <div style={{ fontSize:9, color:C.textSm }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   UI PRIMITIVES
═══════════════════════════════════════════════════ */
function PageHeader({ title, onNew, newLabel="+ Nuevo" }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
      <div style={{ fontWeight:800, fontSize:20 }}>{title}</div>
      {onNew && <button onClick={onNew} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:C.blue, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>{newLabel}</button>}
    </div>
  );
}

function SearchBar({ value, onChange, placeholder, style }) {
  return <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder||"Buscar…"} style={{ ...IS(), padding:"10px 14px", ...style }} />;
}

function Field({ label, children }) {
  return <div style={{ display:"flex", flexDirection:"column", gap:5 }}><label style={{ fontSize:12, fontWeight:600, color:C.textSm }}>{label}</label>{children}</div>;
}

function Grid2({ children }) {
  return <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>{children}</div>;
}

function Stat({ label, value }) {
  return <div><div style={{ fontSize:10, color:C.textSm, textTransform:"uppercase", letterSpacing:.5 }}>{label}</div><div style={{ fontWeight:700, fontSize:14, marginTop:2 }}>{value}</div></div>;
}

function Pill({ label, color, bg }) {
  return <span style={{ background:bg, color, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{label}</span>;
}

function IBtn({ icon, onClick, red }) {
  return <button onClick={onClick} style={{ background:"none", border:`1px solid ${red?C.red+"44":C.border}`, borderRadius:7, padding:"5px 8px", cursor:"pointer", color:red?C.red:C.textMd, fontSize:14 }}>{icon}</button>;
}

function TBtn({ label, color, onClick }) {
  return <button onClick={onClick} style={{ padding:"6px 12px", borderRadius:7, border:`1px solid ${color}44`, background:`${color}18`, color, fontWeight:600, fontSize:12, cursor:"pointer", whiteSpace:"nowrap" }}>{label}</button>;
}

function Empty({ msg }) {
  return <div style={{ color:C.textSm, fontSize:13, padding:"20px 0", textAlign:"center" }}>{msg}</div>;
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.borderHi}`, borderRadius:16, padding:"28px 28px", width:"100%", maxWidth:wide?700:520, maxHeight:"90vh", overflowY:"auto", display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
          <div style={{ fontWeight:800, fontSize:17 }}>{title}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.textSm, cursor:"pointer", fontSize:22, lineHeight:1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onSave, onClose }) {
  return (
    <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:8 }}>
      <button onClick={onClose} style={{ padding:"9px 20px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.textMd, cursor:"pointer", fontSize:14 }}>Cancelar</button>
      <button onClick={onSave} style={{ padding:"9px 20px", borderRadius:8, border:"none", background:C.blue, color:"#fff", fontWeight:700, cursor:"pointer", fontSize:14 }}>Guardar</button>
    </div>
  );
}

function Confirm({ msg, onOk, onCancel }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:2000 }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"28px 32px", maxWidth:360, textAlign:"center" }}>
        <div style={{ fontSize:16, fontWeight:600, marginBottom:20 }}>{msg}</div>
        <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
          <button onClick={onCancel} style={{ padding:"9px 22px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.textMd, cursor:"pointer" }}>Cancelar</button>
          <button onClick={onOk}     style={{ padding:"9px 22px", borderRadius:8, border:"none", background:C.red, color:"#fff", fontWeight:700, cursor:"pointer" }}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// Input style helper
const IS = () => ({ background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"9px 12px", fontSize:13, width:"100%", outline:"none" });

/* ═══════════════════════════════════════════════════
   INVENTORY PAGE
═══════════════════════════════════════════════════ */
function InventoryPage({ data, save, toast }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [delId, setDelId] = useState(null);
  const [adjId, setAdjId] = useState(null);

  const inv = data.inventory || [];
  const cats = ["all", ...new Set(inv.map(i=>i.category))];
  const lowStock = inv.filter(i=>i.qty<=i.minQty);

  const filtered = inv.filter(i=>{
    const matchCat = catFilter==="all" || i.category===catFilter;
    const q = search.toLowerCase();
    return matchCat && (!q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q));
  });

  const upsert = (item) => {
    const list = item.id ? inv.map(i=>i.id===item.id?item:i) : [...inv,{...item,id:uid()}];
    save({ inventory:list }); toast(item.id?"Producto actualizado":"Producto agregado"); setModal(null);
  };
  const del = (id) => { save({ inventory:inv.filter(i=>i.id!==id) }); toast("Eliminado","err"); setDelId(null); };
  const adjust = (id, delta) => {
    const list = inv.map(i=>i.id===id?{...i,qty:Math.max(0,i.qty+delta)}:i);
    save({ inventory:list }); toast(`Stock ajustado`); setAdjId(null);
  };

  const totalValue = inv.reduce((s,i)=>s+(i.cost*i.qty),0);
  const totalSaleValue = inv.reduce((s,i)=>s+(i.price*i.qty),0);

  return (
    <div>
      <PageHeader title={`Inventario (${inv.length} productos)`} onNew={()=>setModal({mode:"new",item:{name:"",category:"Lubricantes",supplierId:data.suppliers?.[0]?.id||"",qty:0,minQty:5,price:0,cost:0,unit:"Unidad",sku:"",notes:""}})} />

      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"Total productos", value:inv.length,           color:C.blueHi },
          { label:"Stock bajo",      value:lowStock.length,      color:lowStock.length>0?C.red:C.green },
          { label:"Valor en costo",  value:fmtCRC(totalValue),   color:C.amber },
          { label:"Valor en venta",  value:fmtCRC(totalSaleValue),color:C.green },
        ].map(s=>(
          <div key={s.label} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 16px" }}>
            <div style={{ fontSize:11, color:C.textSm, textTransform:"uppercase", letterSpacing:.7 }}>{s.label}</div>
            <div style={{ fontSize:20, fontWeight:800, color:s.color, marginTop:5 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {lowStock.length>0 && (
        <div style={{ background:"#2D1000", border:`1px solid ${C.red}44`, borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:13, color:C.red }}>
          ⚠️ <strong>{lowStock.length} producto(s) con stock bajo:</strong> {lowStock.map(i=>i.name).join(", ")}
        </div>
      )}

      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por nombre o SKU…" style={{ flex:1 }} />
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{...IS(),padding:"9px 14px",minWidth:160}}>
          {cats.map(c=><option key={c} value={c}>{c==="all"?"Todas las categorías":c}</option>)}
        </select>
      </div>

      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 120px", padding:"10px 16px", borderBottom:`1px solid ${C.border}`, fontSize:11, fontWeight:700, color:C.textSm, textTransform:"uppercase", letterSpacing:.7 }}>
          <span>Producto</span><span>Categoría</span><span>SKU</span><span>Stock</span><span>Costo</span><span>Precio</span><span>Acciones</span>
        </div>
        {filtered.map(item=>{
          const supplier = (data.suppliers||[]).find(s=>s.id===item.supplierId);
          const low = item.qty<=item.minQty;
          return (
            <div key={item.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 1fr 120px", padding:"12px 16px", borderBottom:`1px solid ${C.border}`, alignItems:"center", background: low?"#1A0A00":undefined }}>
              <div>
                <div style={{ fontWeight:600, fontSize:13 }}>{item.name}</div>
                <div style={{ fontSize:11, color:C.textSm }}>{supplier?.name||"Sin proveedor"} · {item.unit}</div>
              </div>
              <span style={{ fontSize:12, color:C.textMd }}>{item.category}</span>
              <span style={{ fontSize:12, color:C.textSm, fontFamily:"monospace" }}>{item.sku}</span>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontWeight:700, color: low?C.red:C.text }}>{item.qty}</span>
                {low && <span style={{ fontSize:10, color:C.red }}>▼mín:{item.minQty}</span>}
              </div>
              <span style={{ fontSize:13 }}>{fmtCRC(item.cost)}</span>
              <span style={{ fontSize:13, color:C.green, fontWeight:600 }}>{fmtCRC(item.price)}</span>
              <div style={{ display:"flex", gap:4 }}>
                <TBtn label="+/-" color={C.cyan}   onClick={()=>setAdjId(item.id)} />
                <IBtn icon="✏️" onClick={()=>setModal({mode:"edit",item})} />
                <IBtn icon="🗑" red onClick={()=>setDelId(item.id)} />
              </div>
            </div>
          );
        })}
        {filtered.length===0 && <div style={{ padding:24 }}><Empty msg="Sin productos" /></div>}
      </div>

      {modal && <InventoryModal item={modal.item} suppliers={data.suppliers||[]} onSave={upsert} onClose={()=>setModal(null)} />}
      {adjId  && <AdjustModal item={inv.find(i=>i.id===adjId)} onAdjust={adjust} onClose={()=>setAdjId(null)} />}
      {delId  && <Confirm msg="¿Eliminar este producto?" onOk={()=>del(delId)} onCancel={()=>setDelId(null)} />}
    </div>
  );
}

function InventoryModal({ item, suppliers, onSave, onClose }) {
  const [f, setF] = useState(item);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const CATS = ["Lubricantes","Filtros","Frenos","Encendido","Eléctrico","Motor","Suspensión","Carrocería","Herramientas","Otros"];
  const UNITS = ["Unidad","Par","Juego","Litro","Kg","Metro","Caja"];
  return (
    <Modal title={item.id?"Editar producto":"Nuevo producto"} onClose={onClose} wide>
      <Grid2>
        <Field label="Nombre"><input value={f.name} onChange={e=>set("name",e.target.value)} style={IS()} /></Field>
        <Field label="SKU"><input value={f.sku} onChange={e=>set("sku",e.target.value.toUpperCase())} style={IS()} placeholder="LUB-001" /></Field>
        <Field label="Categoría">
          <select value={f.category} onChange={e=>set("category",e.target.value)} style={IS()}>
            {CATS.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Proveedor">
          <select value={f.supplierId} onChange={e=>set("supplierId",e.target.value)} style={IS()}>
            <option value="">Sin proveedor</option>
            {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Unidad">
          <select value={f.unit} onChange={e=>set("unit",e.target.value)} style={IS()}>
            {UNITS.map(u=><option key={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Stock actual"><input type="number" value={f.qty} onChange={e=>set("qty",+e.target.value)} style={IS()} /></Field>
        <Field label="Stock mínimo"><input type="number" value={f.minQty} onChange={e=>set("minQty",+e.target.value)} style={IS()} /></Field>
        <Field label="Costo (₡)"><input type="number" value={f.cost} onChange={e=>set("cost",+e.target.value)} style={IS()} /></Field>
        <Field label="Precio venta (₡)"><input type="number" value={f.price} onChange={e=>set("price",+e.target.value)} style={IS()} /></Field>
      </Grid2>
      <Field label="Notas"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{...IS(),resize:"vertical"}} /></Field>
      <ModalActions onSave={()=>onSave(f)} onClose={onClose} />
    </Modal>
  );
}

function AdjustModal({ item, onAdjust, onClose }) {
  const [delta, setDelta] = useState(0);
  if (!item) return null;
  return (
    <Modal title={`Ajustar stock — ${item.name}`} onClose={onClose}>
      <div style={{ textAlign:"center", padding:"10px 0" }}>
        <div style={{ fontSize:14, color:C.textMd, marginBottom:8 }}>Stock actual: <strong style={{ color:C.text, fontSize:18 }}>{item.qty} {item.unit}</strong></div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:16, marginTop:16 }}>
          <button onClick={()=>setDelta(d=>d-1)} style={{ width:44,height:44,borderRadius:8,border:`1px solid ${C.border}`,background:C.card,color:C.text,fontSize:22,cursor:"pointer" }}>−</button>
          <span style={{ fontSize:32, fontWeight:800, color: delta>0?C.green:delta<0?C.red:C.textMd, minWidth:60, textAlign:"center" }}>{delta>0?"+":""}{delta}</span>
          <button onClick={()=>setDelta(d=>d+1)} style={{ width:44,height:44,borderRadius:8,border:`1px solid ${C.border}`,background:C.card,color:C.text,fontSize:22,cursor:"pointer" }}>+</button>
        </div>
        <div style={{ fontSize:13, color:C.textSm, marginTop:10 }}>Resultado: {item.qty+delta} {item.unit}</div>
      </div>
      <ModalActions onSave={()=>{ if(delta!==0) onAdjust(item.id,delta); else onClose(); }} onClose={onClose} />
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   SUPPLIERS PAGE
═══════════════════════════════════════════════════ */
function SuppliersPage({ data, save, toast }) {
  const [modal, setModal] = useState(null);
  const [delId, setDelId] = useState(null);
  const [search, setSearch] = useState("");

  const suppliers = data.suppliers || [];
  const filtered = suppliers.filter(s=> !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase()));

  const upsert = (item) => {
    const list = item.id ? suppliers.map(s=>s.id===item.id?item:s) : [...suppliers,{...item,id:uid()}];
    save({ suppliers:list }); toast(item.id?"Proveedor actualizado":"Proveedor agregado"); setModal(null);
  };
  const del = (id) => { save({ suppliers:suppliers.filter(s=>s.id!==id) }); toast("Eliminado","err"); setDelId(null); };

  const supplierProducts = (sid) => (data.inventory||[]).filter(i=>i.supplierId===sid);

  return (
    <div>
      <PageHeader title={`Proveedores (${suppliers.length})`} onNew={()=>setModal({mode:"new",item:{name:"",contact:"",phone:"",email:"",category:"",payTerms:"30 días",notes:"",status:"active"}})} />
      <SearchBar value={search} onChange={setSearch} placeholder="Buscar proveedor o categoría…" style={{ marginBottom:16 }} />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:14 }}>
        {filtered.map(s=>{
          const prods = supplierProducts(s.id);
          return (
            <div key={s.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 20px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:15 }}>{s.name}</div>
                  <div style={{ fontSize:12, color:C.blueHi, marginTop:2 }}>{s.category}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                  <Pill label={s.status==="active"?"Activo":"Inactivo"} color={s.status==="active"?C.green:C.textSm} bg={s.status==="active"?"#002D1A":C.border} />
                  <div style={{ display:"flex", gap:5 }}>
                    <IBtn icon="✏️" onClick={()=>setModal({mode:"edit",item:s})} />
                    <IBtn icon="🗑" red onClick={()=>setDelId(s.id)} />
                  </div>
                </div>
              </div>
              <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:4 }}>
                {s.contact && <div style={{ fontSize:12, color:C.textMd }}>👤 {s.contact}</div>}
                {s.phone   && <div style={{ fontSize:12, color:C.textMd }}>📱 {s.phone}</div>}
                {s.email   && <div style={{ fontSize:12, color:C.textMd }}>✉️ {s.email}</div>}
                <div style={{ fontSize:12, color:C.textMd }}>💳 Condición de pago: {s.payTerms}</div>
              </div>
              <div style={{ display:"flex", gap:12, marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
                <Stat label="Productos" value={prods.length} />
                <Stat label="Valor inventario" value={fmtCRC(prods.reduce((sum,p)=>sum+(p.cost*p.qty),0))} />
              </div>
              {s.notes && <div style={{ marginTop:10, fontSize:12, color:C.textSm }}>💬 {s.notes}</div>}
            </div>
          );
        })}
        {filtered.length===0 && <Empty msg="No se encontraron proveedores" />}
      </div>

      {modal && <SupplierModal item={modal.item} onSave={upsert} onClose={()=>setModal(null)} />}
      {delId  && <Confirm msg="¿Eliminar este proveedor?" onOk={()=>del(delId)} onCancel={()=>setDelId(null)} />}
    </div>
  );
}

function SupplierModal({ item, onSave, onClose }) {
  const [f, setF] = useState(item);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const TERMS = ["Contado","7 días","15 días","30 días","60 días","Crédito especial"];
  const CATS  = ["Repuestos generales","Lubricantes y fluidos","Frenos y seguridad","Eléctrico y electrónico","Motor y transmisión","Carrocería","Herramientas","Otros"];
  return (
    <Modal title={item.id?"Editar proveedor":"Nuevo proveedor"} onClose={onClose} wide>
      <Grid2>
        <Field label="Nombre empresa"><input value={f.name} onChange={e=>set("name",e.target.value)} style={IS()} /></Field>
        <Field label="Contacto"><input value={f.contact} onChange={e=>set("contact",e.target.value)} style={IS()} /></Field>
        <Field label="Teléfono"><input value={f.phone} onChange={e=>set("phone",e.target.value)} style={IS()} /></Field>
        <Field label="Correo"><input value={f.email} onChange={e=>set("email",e.target.value)} style={IS()} /></Field>
        <Field label="Categoría">
          <select value={f.category} onChange={e=>set("category",e.target.value)} style={IS()}>
            {CATS.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Condición de pago">
          <select value={f.payTerms} onChange={e=>set("payTerms",e.target.value)} style={IS()}>
            {TERMS.map(t=><option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select value={f.status} onChange={e=>set("status",e.target.value)} style={IS()}>
            <option value="active">Activo</option><option value="inactive">Inactivo</option>
          </select>
        </Field>
      </Grid2>
      <Field label="Notas"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{...IS(),resize:"vertical"}} /></Field>
      <ModalActions onSave={()=>onSave(f)} onClose={onClose} />
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   ACCOUNTING PAGE
═══════════════════════════════════════════════════ */
function AccountingPage({ data, save, toast }) {
  const [modal, setModal] = useState(null);
  const [delId, setDelId] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [period, setPeriod] = useState("month");

  const entries = data.accounting || [];

  const now = new Date();
  const filtered = entries.filter(e=>{
    const matchType = typeFilter==="all" || e.type===typeFilter;
    const eDate = new Date(e.date);
    let matchPeriod = true;
    if (period==="month") matchPeriod = eDate.getMonth()===now.getMonth() && eDate.getFullYear()===now.getFullYear();
    if (period==="week")  { const weekAgo=new Date(); weekAgo.setDate(weekAgo.getDate()-7); matchPeriod=eDate>=weekAgo; }
    return matchType && matchPeriod;
  }).sort((a,b)=>b.date.localeCompare(a.date));

  const totalIncome  = filtered.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0);
  const totalExpense = filtered.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0);
  const balance      = totalIncome - totalExpense;

  // Category breakdown
  const catBreakdown = {};
  filtered.forEach(e=>{ catBreakdown[e.category]=(catBreakdown[e.category]||0)+e.amount; });
  const topCats = Object.entries(catBreakdown).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxCat  = Math.max(...topCats.map(x=>x[1]),1);

  const upsert = (item) => {
    const list = item.id ? entries.map(e=>e.id===item.id?item:e) : [...entries,{...item,id:uid()}];
    save({ accounting:list }); toast(item.id?"Registro actualizado":"Registro agregado"); setModal(null);
  };
  const del = (id) => { save({ accounting:entries.filter(e=>e.id!==id) }); toast("Eliminado","err"); setDelId(null); };

  const CATS_INCOME  = ["Servicio","Repuesto","Diagnóstico","Otro ingreso"];
  const CATS_EXPENSE = ["Inventario","Salarios","Servicios","Alquiler","Herramientas","Mantenimiento","Otro gasto"];

  return (
    <div>
      <PageHeader title="Contabilidad" onNew={()=>setModal({mode:"new",item:{type:"income",category:"Servicio",description:"",amount:0,date:today(),ref:"",notes:""}})} newLabel="+ Nuevo registro" />

      {/* Summary cards */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:24 }}>
        <div style={{ background:C.card, border:`1px solid ${C.green}44`, borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:11, color:C.textSm, textTransform:"uppercase", letterSpacing:.7 }}>Ingresos</div>
          <div style={{ fontSize:26, fontWeight:800, color:C.green, marginTop:5 }}>{fmtCRC(totalIncome)}</div>
        </div>
        <div style={{ background:C.card, border:`1px solid ${C.red}44`, borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:11, color:C.textSm, textTransform:"uppercase", letterSpacing:.7 }}>Gastos</div>
          <div style={{ fontSize:26, fontWeight:800, color:C.red, marginTop:5 }}>{fmtCRC(totalExpense)}</div>
        </div>
        <div style={{ background:C.card, border:`1px solid ${balance>=0?C.blueHi:C.red}44`, borderRadius:12, padding:"18px 20px" }}>
          <div style={{ fontSize:11, color:C.textSm, textTransform:"uppercase", letterSpacing:.7 }}>Balance</div>
          <div style={{ fontSize:26, fontWeight:800, color:balance>=0?C.blueHi:C.red, marginTop:5 }}>{fmtCRC(balance)}</div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:20, marginBottom:24 }}>
        {/* Transactions list */}
        <div>
          <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
            {[["all","Todos"],["income","Ingresos"],["expense","Gastos"]].map(([v,l])=>(
              <button key={v} onClick={()=>setTypeFilter(v)} style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${typeFilter===v?C.blueHi:C.border}`, background:typeFilter===v?`${C.blue}22`:"transparent", color:typeFilter===v?C.blueHi:C.textMd, cursor:"pointer", fontSize:13, fontWeight:typeFilter===v?700:400 }}>{l}</button>
            ))}
            <select value={period} onChange={e=>setPeriod(e.target.value)} style={{...IS(),padding:"7px 12px",minWidth:120}}>
              <option value="all">Todo</option>
              <option value="month">Este mes</option>
              <option value="week">Esta semana</option>
            </select>
          </div>

          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
            {filtered.map((e,idx)=>(
              <div key={e.id} style={{ display:"grid", gridTemplateColumns:"1fr auto auto 80px", gap:12, padding:"12px 16px", borderBottom: idx<filtered.length-1?`1px solid ${C.border}`:undefined, alignItems:"center" }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{e.description}</div>
                  <div style={{ fontSize:11, color:C.textSm, marginTop:2 }}>{e.category} · {fmtDate(e.date)} {e.ref&&`· Ref: ${e.ref}`}</div>
                </div>
                <span style={{ fontWeight:700, fontSize:14, color:e.type==="income"?C.green:C.red, whiteSpace:"nowrap" }}>
                  {e.type==="income"?"+":"-"}{fmtCRC(e.amount)}
                </span>
                <Pill label={e.type==="income"?"Ingreso":"Gasto"} color={e.type==="income"?C.green:C.red} bg={e.type==="income"?"#002D1A":"#2D0000"} />
                <div style={{ display:"flex", gap:4 }}>
                  <IBtn icon="✏️" onClick={()=>setModal({mode:"edit",item:e})} />
                  <IBtn icon="🗑" red onClick={()=>setDelId(e.id)} />
                </div>
              </div>
            ))}
            {filtered.length===0 && <div style={{ padding:24 }}><Empty msg="Sin registros" /></div>}
          </div>
        </div>

        {/* Category breakdown */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"20px" }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:16 }}>Por categoría</div>
          {topCats.map(([cat,val],i)=>(
            <div key={cat} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:4 }}>
                <span style={{ color:C.text }}>{cat}</span>
                <span style={{ color:C.textSm }}>{fmtCRC(val)}</span>
              </div>
              <div style={{ height:7, background:C.bg, borderRadius:4 }}>
                <div style={{ height:"100%", width:`${(val/maxCat)*100}%`, background:[C.blueHi,C.green,C.amber,C.purple,C.red][i%5], borderRadius:4 }} />
              </div>
            </div>
          ))}
          {topCats.length===0 && <Empty msg="Sin datos" />}
        </div>
      </div>

      {modal && (
        <Modal title={modal.item.id?"Editar registro":"Nuevo registro"} onClose={()=>setModal(null)}>
          <AccountingForm item={modal.item} onSave={upsert} onClose={()=>setModal(null)} incCats={CATS_INCOME} expCats={CATS_EXPENSE} />
        </Modal>
      )}
      {delId && <Confirm msg="¿Eliminar este registro?" onOk={()=>del(delId)} onCancel={()=>setDelId(null)} />}
    </div>
  );
}

function AccountingForm({ item, onSave, onClose, incCats, expCats }) {
  const [f, setF] = useState(item);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const cats = f.type==="income" ? incCats : expCats;
  return (
    <>
      <Grid2>
        <Field label="Tipo">
          <select value={f.type} onChange={e=>{ set("type",e.target.value); set("category", e.target.value==="income"?incCats[0]:expCats[0]); }} style={IS()}>
            <option value="income">Ingreso</option>
            <option value="expense">Gasto</option>
          </select>
        </Field>
        <Field label="Categoría">
          <select value={f.category} onChange={e=>set("category",e.target.value)} style={IS()}>
            {cats.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Monto (₡)"><input type="number" value={f.amount} onChange={e=>set("amount",+e.target.value)} style={IS()} /></Field>
        <Field label="Fecha"><input type="date" value={f.date} onChange={e=>set("date",e.target.value)} style={IS()} /></Field>
        <Field label="Referencia"><input value={f.ref} onChange={e=>set("ref",e.target.value)} style={IS()} placeholder="Número de orden, factura…" /></Field>
      </Grid2>
      <Field label="Descripción"><input value={f.description} onChange={e=>set("description",e.target.value)} style={IS()} /></Field>
      <Field label="Notas"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{...IS(),resize:"vertical",marginTop:4}} /></Field>
      <ModalActions onSave={()=>onSave(f)} onClose={onClose} />
    </>
  );
}

/* ═══════════════════════════════════════════════════
   LIBRARY PAGE (PDF uploads)
═══════════════════════════════════════════════════ */
function LibraryPage({ data, save, toast }) {
  const [modal,    setModal]   = useState(null);
  const [delId,    setDelId]   = useState(null);
  const [search,   setSearch]  = useState("");
  const [catFilter,setCatFilter]= useState("all");
  const fileRef = useRef(null);
  const [pendingFile, setPendingFile] = useState(null);

  const lib = data.library || [];
  const cats = ["all", ...new Set(lib.map(b=>b.category))];

  const filtered = lib.filter(b=>{
    const matchCat = catFilter==="all" || b.category===catFilter;
    const q = search.toLowerCase();
    return matchCat && (!q || b.title.toLowerCase().includes(q) || b.brand.toLowerCase().includes(q) || b.model.toLowerCase().includes(q));
  });

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".pdf")) { toast("Solo se permiten archivos PDF","err"); return; }
    const sizeMB = (file.size/1024/1024).toFixed(1)+" MB";
    setPendingFile({ fileName:file.name, fileSize:sizeMB });
    setModal({ mode:"new", item:{ title:file.name.replace(".pdf",""), brand:"", model:"", year:new Date().getFullYear(), category:"Manual técnico", uploadDate:today(), fileSize:sizeMB, notes:"" } });
    e.target.value = "";
  };

  const upsert = (item) => {
    const list = item.id ? lib.map(b=>b.id===item.id?item:b) : [...lib,{...item,id:uid()}];
    save({ library:list }); toast(item.id?"Actualizado":"Manual agregado a la biblioteca"); setModal(null); setPendingFile(null);
  };
  const del = (id) => { save({ library:lib.filter(b=>b.id!==id) }); toast("Eliminado","err"); setDelId(null); };

  const CAT_ICONS = { "Manual técnico":"📘","Diagramas eléctricos":"⚡","Manual de usuario":"📗","Boletín técnico":"📄","Catálogo de partes":"🗂","Otro":"📎" };
  const LIB_CATS  = Object.keys(CAT_ICONS);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
        <div style={{ fontWeight:800, fontSize:20 }}>Biblioteca técnica ({lib.length} documentos)</div>
        <div style={{ display:"flex", gap:10 }}>
          <input ref={fileRef} type="file" accept=".pdf" onChange={handleFileSelect} style={{ display:"none" }} />
          <button onClick={()=>fileRef.current?.click()} style={{ padding:"9px 18px", borderRadius:9, border:`1px solid ${C.border}`, background:"transparent", color:C.textMd, fontWeight:600, fontSize:13, cursor:"pointer" }}>📎 Subir PDF</button>
          <button onClick={()=>setModal({mode:"new",item:{title:"",brand:"",model:"",year:new Date().getFullYear(),category:"Manual técnico",uploadDate:today(),fileSize:"—",notes:""}})} style={{ padding:"9px 18px", borderRadius:9, border:"none", background:C.blue, color:"#fff", fontWeight:700, fontSize:13, cursor:"pointer" }}>+ Registrar manual</button>
        </div>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap" }}>
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar por título, marca o modelo…" style={{ flex:1 }} />
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{...IS(),padding:"9px 14px",minWidth:180}}>
          {cats.map(c=><option key={c} value={c}>{c==="all"?"Todas las categorías":c}</option>)}
        </select>
      </div>

      {/* Category summary pills */}
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {LIB_CATS.map(cat=>{
          const count = lib.filter(b=>b.category===cat).length;
          if (!count) return null;
          return <div key={cat} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:8, padding:"6px 14px", fontSize:12, display:"flex", gap:6, alignItems:"center" }}><span>{CAT_ICONS[cat]}</span><span style={{ fontWeight:600 }}>{cat}</span><span style={{ color:C.textSm }}>{count}</span></div>;
        })}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
        {filtered.map(b=>(
          <div key={b.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 20px", display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div style={{ fontSize:32 }}>{CAT_ICONS[b.category]||"📎"}</div>
              <div style={{ display:"flex", gap:5 }}>
                <IBtn icon="✏️" onClick={()=>setModal({mode:"edit",item:b})} />
                <IBtn icon="🗑" red onClick={()=>setDelId(b.id)} />
              </div>
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:14, lineHeight:1.3 }}>{b.title}</div>
              <div style={{ fontSize:12, color:C.blueHi, marginTop:3 }}>{b.category}</div>
            </div>
            <div style={{ display:"flex", gap:12 }}>
              <Stat label="Marca"    value={b.brand||"—"} />
              <Stat label="Modelo"   value={b.model||"—"} />
              <Stat label="Año"      value={b.year||"—"} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", paddingTop:10, borderTop:`1px solid ${C.border}`, fontSize:11, color:C.textSm }}>
              <span>📅 {fmtDate(b.uploadDate)}</span>
              <span>📄 {b.fileSize}</span>
            </div>
            {b.notes && <div style={{ fontSize:12, color:C.textSm }}>💬 {b.notes}</div>}
          </div>
        ))}
        {filtered.length===0 && <Empty msg="No se encontraron documentos" />}
      </div>

      {pendingFile && (
        <div style={{ background:"#001A2D", border:`1px solid ${C.cyan}44`, borderRadius:10, padding:"12px 16px", marginBottom:16, marginTop:16, fontSize:13, color:C.cyan }}>
          📎 Archivo seleccionado: <strong>{pendingFile.fileName}</strong> ({pendingFile.fileSize}) — Completa el formulario para registrarlo.
        </div>
      )}

      {modal && (
        <Modal title={modal.item.id?"Editar documento":"Registrar documento"} onClose={()=>{ setModal(null); setPendingFile(null); }}>
          <LibraryModal item={modal.item} cats={LIB_CATS} onSave={upsert} onClose={()=>{ setModal(null); setPendingFile(null); }} />
        </Modal>
      )}
      {delId && <Confirm msg="¿Eliminar este documento de la biblioteca?" onOk={()=>del(delId)} onCancel={()=>setDelId(null)} />}
    </div>
  );
}

function LibraryModal({ item, cats, onSave, onClose }) {
  const [f, setF] = useState(item);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  return (
    <>
      <Field label="Título del documento"><input value={f.title} onChange={e=>set("title",e.target.value)} style={IS()} /></Field>
      <Grid2>
        <Field label="Marca / Fabricante"><input value={f.brand} onChange={e=>set("brand",e.target.value)} style={IS()} placeholder="Toyota, Honda, Kia…" /></Field>
        <Field label="Modelo"><input value={f.model} onChange={e=>set("model",e.target.value)} style={IS()} /></Field>
        <Field label="Año"><input type="number" value={f.year} onChange={e=>set("year",+e.target.value)} style={IS()} /></Field>
        <Field label="Categoría">
          <select value={f.category} onChange={e=>set("category",e.target.value)} style={IS()}>
            {cats.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Tamaño del archivo"><input value={f.fileSize} onChange={e=>set("fileSize",e.target.value)} style={IS()} placeholder="8.5 MB" /></Field>
        <Field label="Fecha de subida"><input type="date" value={f.uploadDate} onChange={e=>set("uploadDate",e.target.value)} style={IS()} /></Field>
      </Grid2>
      <Field label="Notas"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{...IS(),resize:"vertical"}} /></Field>
      <ModalActions onSave={()=>onSave(f)} onClose={onClose} />
    </>
  );
}

/* ═══════════════════════════════════════════════════
   INTAKE PAGE — Ingreso rápido de auto + cliente
═══════════════════════════════════════════════════ */
function IntakePage({ data, save, toast }) {
  const STEPS = ["Cliente", "Vehículo", "Servicio", "Confirmar"];
  const [step, setStep] = useState(0);
  const [clientMode, setClientMode] = useState("new"); // "new" | "existing"
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [vehicleMode, setVehicleMode] = useState("new"); // "new" | "existing"
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  const emptyClient  = { name:"", phone:"", email:"", idNum:"", notes:"" };
  const emptyVehicle = { plate:"", brand:"", model:"", year:new Date().getFullYear(), color:"", vin:"", km:0, fuel:"Gasolina", notes:"" };
  const emptyOrder   = { serviceIds:[], notes:"", mechanic: data.workers?.[0]?.name||"", date:today(), parts:[] };

  const [cForm, setCForm] = useState(emptyClient);
  const [vForm, setVForm] = useState(emptyVehicle);
  const [oForm, setOForm] = useState(emptyOrder);
  const [done,  setDone]  = useState(false);

  const setC = (k,v) => setCForm(p=>({...p,[k]:v}));
  const setV = (k,v) => setVForm(p=>({...p,[k]:v}));
  const setO = (k,v) => setOForm(p=>({...p,[k]:v}));

  const filteredClients = data.clients.filter(c =>
    clientSearch.length > 1 &&
    (c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
     c.phone.includes(clientSearch) ||
     c.idNum?.includes(clientSearch))
  );

  const clientVehicles = selectedClient
    ? data.vehicles.filter(v => v.clientId === selectedClient.id)
    : [];

  const toggleService = (id) => {
    setOForm(p => ({
      ...p,
      serviceIds: p.serviceIds.includes(id)
        ? p.serviceIds.filter(s => s !== id)
        : [...p.serviceIds, id]
    }));
  };

  const handleFinish = () => {
    let clientId, vehicleId;
    const newClients = [...data.clients];
    const newVehicles = [...data.vehicles];
    const newOrders = [...data.orders];
    const newAccounting = [...(data.accounting||[])];

    if (clientMode === "existing" && selectedClient) {
      clientId = selectedClient.id;
    } else {
      clientId = uid();
      newClients.push({ ...cForm, id: clientId });
    }

    if (vehicleMode === "existing" && selectedVehicle) {
      vehicleId = selectedVehicle.id;
    } else {
      vehicleId = uid();
      newVehicles.push({ ...vForm, id: vehicleId, clientId });
    }

    const total = oForm.serviceIds.reduce((s,sid) => s + ((data.services||SERVICES_CAT).find(x=>x.id===sid)?.price||0), 0)
                + oForm.parts.reduce((s,p) => s + (+p.price * +p.qty), 0);

    const orderId = uid();
    newOrders.push({
      id: orderId,
      clientId,
      vehicleId,
      services: oForm.serviceIds,
      parts: oForm.parts,
      status: "active",
      date: oForm.date,
      total,
      notes: oForm.notes,
      mechanic: oForm.mechanic,
    });

    save({ clients: newClients, vehicles: newVehicles, orders: newOrders, accounting: newAccounting });
    toast("Auto ingresado y orden creada ✓");
    setDone(true);
  };

  const reset = () => {
    setStep(0); setClientMode("new"); setVehicleMode("new");
    setSelectedClient(null); setSelectedVehicle(null);
    setCForm(emptyClient); setVForm(emptyVehicle); setOForm(emptyOrder);
    setClientSearch(""); setDone(false);
  };

  if (done) return (
    <div style={{ maxWidth:480, margin:"60px auto", textAlign:"center" }}>
      <div style={{ fontSize:64, marginBottom:16 }}>✅</div>
      <div style={{ fontSize:22, fontWeight:800, marginBottom:8 }}>Auto ingresado con éxito</div>
      <div style={{ color:C.textMd, fontSize:14, marginBottom:32 }}>La orden de trabajo fue creada y está activa.</div>
      <div style={{ display:"flex", gap:12, justifyContent:"center" }}>
        <button onClick={reset} style={{ padding:"12px 28px", borderRadius:10, border:"none", background:C.blue, color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer" }}>Ingresar otro auto</button>
        <button onClick={()=>{ reset(); }} style={{ padding:"12px 28px", borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color:C.textMd, fontSize:15, cursor:"pointer" }}>Ir al inicio</button>
      </div>
    </div>
  );

  const canNext = [
    () => clientMode==="existing" ? !!selectedClient : cForm.name.trim().length>0 && cForm.phone.trim().length>0,
    () => vehicleMode==="existing" ? !!selectedVehicle : vForm.plate.trim().length>0 && vForm.brand.trim().length>0,
    () => oForm.serviceIds.length > 0,
    () => true,
  ];

  return (
    <div style={{ maxWidth:680, margin:"0 auto" }}>
      <div style={{ fontWeight:800, fontSize:22, marginBottom:24 }}>🚘 Ingreso rápido de vehículo</div>

      {/* Step indicator */}
      <div style={{ display:"flex", gap:0, marginBottom:32 }}>
        {STEPS.map((s,i) => (
          <div key={s} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
            <div style={{ width:32, height:32, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, background: i<step?C.green : i===step?C.blue:C.border, color:"#fff", transition:"background .2s" }}>{i<step?"✓":i+1}</div>
            <div style={{ fontSize:11, color: i===step?C.blueHi:C.textSm, fontWeight: i===step?700:400 }}>{s}</div>
            {i<STEPS.length-1 && <div style={{ position:"absolute", width:"calc(25% - 32px)", height:2, background: i<step?C.green:C.border }} />}
          </div>
        ))}
      </div>

      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"28px 28px", minHeight:320 }}>

        {/* STEP 0 — CLIENTE */}
        {step===0 && (
          <div>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:20 }}>👤 Datos del cliente</div>
            <div style={{ display:"flex", gap:8, marginBottom:20 }}>
              {[["new","Cliente nuevo"],["existing","Cliente existente"]].map(([v,l])=>(
                <button key={v} onClick={()=>{ setClientMode(v); setSelectedClient(null); }} style={{ flex:1, padding:"10px", borderRadius:9, border:`1px solid ${clientMode===v?C.blueHi:C.border}`, background:clientMode===v?`${C.blue}22`:"transparent", color:clientMode===v?C.blueHi:C.textMd, cursor:"pointer", fontWeight:600, fontSize:13 }}>{l}</button>
              ))}
            </div>

            {clientMode==="existing" ? (
              <div>
                <Field label="Buscar cliente (nombre, teléfono o cédula)">
                  <input value={clientSearch} onChange={e=>setClientSearch(e.target.value)} placeholder="Escriba al menos 2 letras…" style={IS()} />
                </Field>
                {filteredClients.length>0 && (
                  <div style={{ marginTop:10, border:`1px solid ${C.border}`, borderRadius:10, overflow:"hidden" }}>
                    {filteredClients.map(c=>(
                      <div key={c.id} onClick={()=>{ setSelectedClient(c); setClientSearch(c.name); }} style={{ padding:"12px 16px", cursor:"pointer", background: selectedClient?.id===c.id?`${C.blue}22`:undefined, borderBottom:`1px solid ${C.border}` }}>
                        <div style={{ fontWeight:600 }}>{c.name}</div>
                        <div style={{ fontSize:12, color:C.textSm }}>{c.phone} · {c.idNum}</div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedClient && (
                  <div style={{ marginTop:16, background:`${C.green}11`, border:`1px solid ${C.green}44`, borderRadius:10, padding:"12px 16px" }}>
                    <div style={{ fontWeight:700, color:C.green }}>✓ {selectedClient.name}</div>
                    <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>{selectedClient.phone} · {selectedClient.idNum}</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <Field label="Nombre completo *"><input value={cForm.name} onChange={e=>setC("name",e.target.value)} style={IS()} /></Field>
                <Field label="Teléfono *"><input value={cForm.phone} onChange={e=>setC("phone",e.target.value)} style={IS()} /></Field>
                <Field label="Correo electrónico"><input value={cForm.email} onChange={e=>setC("email",e.target.value)} style={IS()} /></Field>
                <Field label="Cédula / ID"><input value={cForm.idNum} onChange={e=>setC("idNum",e.target.value)} style={IS()} /></Field>
                <div style={{ gridColumn:"span 2" }}>
                  <Field label="Notas"><textarea value={cForm.notes} onChange={e=>setC("notes",e.target.value)} rows={2} style={{...IS(),resize:"vertical"}} /></Field>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 1 — VEHÍCULO */}
        {step===1 && (
          <div>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:20 }}>🚗 Datos del vehículo</div>
            {clientVehicles.length>0 && (
              <div style={{ display:"flex", gap:8, marginBottom:20 }}>
                {[["new","Vehículo nuevo"],["existing","Vehículo registrado"]].map(([v,l])=>(
                  <button key={v} onClick={()=>{ setVehicleMode(v); setSelectedVehicle(null); }} style={{ flex:1, padding:"10px", borderRadius:9, border:`1px solid ${vehicleMode===v?C.blueHi:C.border}`, background:vehicleMode===v?`${C.blue}22`:"transparent", color:vehicleMode===v?C.blueHi:C.textMd, cursor:"pointer", fontWeight:600, fontSize:13 }}>{l}</button>
                ))}
              </div>
            )}

            {vehicleMode==="existing" && clientVehicles.length>0 ? (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {clientVehicles.map(v=>(
                  <div key={v.id} onClick={()=>setSelectedVehicle(v)} style={{ padding:"14px 16px", borderRadius:10, border:`1px solid ${selectedVehicle?.id===v.id?C.blueHi:C.border}`, background:selectedVehicle?.id===v.id?`${C.blue}22`:undefined, cursor:"pointer" }}>
                    <div style={{ fontWeight:700 }}>{v.plate} — {v.year} {v.brand} {v.model}</div>
                    <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>{v.color} · {v.fuel} · {Number(v.km).toLocaleString()} km</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <Field label="Placa *"><input value={vForm.plate} onChange={e=>setV("plate",e.target.value.toUpperCase())} placeholder="ABC-123" style={IS()} /></Field>
                <Field label="Marca *"><input value={vForm.brand} onChange={e=>setV("brand",e.target.value)} placeholder="Toyota" style={IS()} /></Field>
                <Field label="Modelo *"><input value={vForm.model} onChange={e=>setV("model",e.target.value)} placeholder="Corolla" style={IS()} /></Field>
                <Field label="Año"><input type="number" value={vForm.year} onChange={e=>setV("year",+e.target.value)} style={IS()} /></Field>
                <Field label="Color"><input value={vForm.color} onChange={e=>setV("color",e.target.value)} style={IS()} /></Field>
                <Field label="Combustible">
                  <select value={vForm.fuel} onChange={e=>setV("fuel",e.target.value)} style={IS()}>
                    {["Gasolina","Diésel","Híbrido","Eléctrico"].map(f=><option key={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Kilometraje"><input type="number" value={vForm.km} onChange={e=>setV("km",+e.target.value)} style={IS()} /></Field>
                <Field label="VIN / Chasis"><input value={vForm.vin} onChange={e=>setV("vin",e.target.value.toUpperCase())} style={IS()} /></Field>
                <div style={{ gridColumn:"span 2" }}>
                  <Field label="Notas"><textarea value={vForm.notes} onChange={e=>setV("notes",e.target.value)} rows={2} style={{...IS(),resize:"vertical"}} /></Field>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — SERVICIO */}
        {step===2 && (
          <div>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:20 }}>🔧 Servicios y mecánico</div>
            <Field label="Servicios a realizar *">
              <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:6 }}>
                {(data.services||SERVICES_CAT).map(s=>{
                  const sel = oForm.serviceIds.includes(s.id);
                  return (
                    <button key={s.id} onClick={()=>toggleService(s.id)} style={{ padding:"8px 14px", borderRadius:8, border:`1px solid ${sel?C.blueHi:C.border}`, background:sel?`${C.blue}22`:"transparent", color:sel?C.blueHi:C.textMd, cursor:"pointer", fontSize:13, fontWeight:sel?700:400 }}>
                      {s.name} <span style={{ color:C.textSm, fontSize:11 }}>· {fmtCRC(s.price)}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginTop:16 }}>
              <Field label="Mecánico asignado">
                <select value={oForm.mechanic} onChange={e=>setO("mechanic",e.target.value)} style={IS()}>
                  {data.workers.filter(w=>w.status==="active").map(w=><option key={w.id} value={w.name}>{w.name}</option>)}
                </select>
              </Field>
              <Field label="Fecha"><input type="date" value={oForm.date} onChange={e=>setO("date",e.target.value)} style={IS()} /></Field>
            </div>
            <div style={{ marginTop:14 }}>
              <Field label="Notas / problema reportado"><textarea value={oForm.notes} onChange={e=>setO("notes",e.target.value)} rows={3} placeholder="Describe el problema que reporta el cliente…" style={{...IS(),resize:"vertical"}} /></Field>
            </div>
            {oForm.serviceIds.length>0 && (
              <div style={{ marginTop:16, background:C.bg, borderRadius:10, padding:"12px 16px", display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:C.textMd, fontSize:14 }}>Total estimado ({oForm.serviceIds.length} servicios)</span>
                <span style={{ fontWeight:800, fontSize:18, color:C.green }}>{fmtCRC(oForm.serviceIds.reduce((s,id)=>s+((data.services||SERVICES_CAT).find(x=>x.id===id)?.price||0),0))}</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 3 — CONFIRM */}
        {step===3 && (
          <div>
            <div style={{ fontWeight:700, fontSize:16, marginBottom:20 }}>✅ Confirmar ingreso</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div style={{ background:C.bg, borderRadius:10, padding:"16px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.textSm, textTransform:"uppercase", letterSpacing:.7, marginBottom:10 }}>Cliente</div>
                {clientMode==="existing"&&selectedClient ? (
                  <><div style={{ fontWeight:700 }}>{selectedClient.name}</div><div style={{ fontSize:12, color:C.textSm }}>{selectedClient.phone}</div></>
                ) : (
                  <><div style={{ fontWeight:700 }}>{cForm.name}</div><div style={{ fontSize:12, color:C.textSm }}>{cForm.phone}</div></>
                )}
              </div>
              <div style={{ background:C.bg, borderRadius:10, padding:"16px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:C.textSm, textTransform:"uppercase", letterSpacing:.7, marginBottom:10 }}>Vehículo</div>
                {vehicleMode==="existing"&&selectedVehicle ? (
                  <><div style={{ fontWeight:700 }}>{selectedVehicle.plate}</div><div style={{ fontSize:12, color:C.textSm }}>{selectedVehicle.year} {selectedVehicle.brand} {selectedVehicle.model}</div></>
                ) : (
                  <><div style={{ fontWeight:700 }}>{vForm.plate}</div><div style={{ fontSize:12, color:C.textSm }}>{vForm.year} {vForm.brand} {vForm.model}</div></>
                )}
              </div>
            </div>
            <div style={{ background:C.bg, borderRadius:10, padding:"16px", marginTop:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.textSm, textTransform:"uppercase", letterSpacing:.7, marginBottom:10 }}>Servicios</div>
              {oForm.serviceIds.map(sid=>{
                const s = (data.services||SERVICES_CAT).find(x=>x.id===sid);
                return s ? <div key={sid} style={{ display:"flex", justifyContent:"space-between", fontSize:13, padding:"4px 0", borderBottom:`1px solid ${C.border}` }}><span>{s.name}</span><span style={{ color:C.green }}>{fmtCRC(s.price)}</span></div> : null;
              })}
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, fontWeight:800, fontSize:16 }}>
                <span>Total</span>
                <span style={{ color:C.green }}>{fmtCRC(oForm.serviceIds.reduce((s,id)=>s+((data.services||SERVICES_CAT).find(x=>x.id===id)?.price||0),0))}</span>
              </div>
            </div>
            <div style={{ marginTop:10, fontSize:13, color:C.textSm }}>Mecánico: {oForm.mechanic} · Fecha: {fmtDate(oForm.date)}</div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:20 }}>
        <button onClick={()=>setStep(s=>s-1)} disabled={step===0} style={{ padding:"11px 24px", borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color: step===0?C.border:C.textMd, cursor:step===0?"default":"pointer", fontSize:14, fontWeight:600 }}>← Atrás</button>
        {step<STEPS.length-1
          ? <button onClick={()=>{ if(canNext[step]()) setStep(s=>s+1); else toast("Completa los campos requeridos","err"); }} style={{ padding:"11px 28px", borderRadius:10, border:"none", background:C.blue, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>Siguiente →</button>
          : <button onClick={handleFinish} style={{ padding:"11px 28px", borderRadius:10, border:"none", background:C.green, color:"#fff", fontWeight:800, fontSize:14, cursor:"pointer" }}>✅ Confirmar ingreso</button>
        }
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   AI HELPER — shared Claude API call
═══════════════════════════════════════════════════ */
async function callClaude(systemPrompt, userMsg) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({
      model:"claude-sonnet-4-6",
      max_tokens:1000,
      system: systemPrompt,
      messages:[{ role:"user", content:userMsg }]
    })
  });
  const data = await res.json();
  return data.content?.map(b=>b.text||"").join("") || "Sin respuesta";
}

/* ═══════════════════════════════════════════════════
   AI DIAGNOSIS PAGE
═══════════════════════════════════════════════════ */
function AIDiagPage({ data }) {
  const [brand,   setBrand]   = useState("");
  const [model,   setModel]   = useState("");
  const [year,    setYear]    = useState("");
  const [km,      setKm]      = useState("");
  const [problem, setProblem] = useState("");
  const [codes,   setCodes]   = useState("");
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!problem.trim()) return;
    setLoading(true); setResult(null);
    const sys = `Eres un mecánico automotriz experto con más de 20 años de experiencia en diagnóstico de vehículos. Respondes en español de Costa Rica. Siempre estructuras tu respuesta en secciones claras: CAUSAS PROBABLES, DIAGNÓSTICO RECOMENDADO, PIEZAS POSIBLES A REEMPLAZAR, y ADVERTENCIAS DE SEGURIDAD. Sé específico y práctico.`;
    const msg = `Vehículo: ${year||"?"} ${brand||"?"} ${model||"?"}${km?`, ${km} km`:""}.\nProblema reportado: ${problem}${codes?`\nCódigos OBD: ${codes}`:""}\n\nProporciona un diagnóstico detallado.`;
    try {
      const r = await callClaude(sys, msg);
      setResult(r);
    } catch { setResult("Error al conectar con la IA. Intenta nuevamente."); }
    setLoading(false);
  };

  const quickFill = (v) => {
    const vehicle = data.vehicles.find(x=>x.id===v);
    if (vehicle) { setBrand(vehicle.brand); setModel(vehicle.model); setYear(String(vehicle.year)); setKm(String(vehicle.km)); }
  };

  return (
    <div style={{ maxWidth:800, margin:"0 auto" }}>
      <AIPageHeader icon="🤖" title="Asistente de Diagnóstico IA" desc="Describe el problema del vehículo y la IA te sugiere causas, diagnóstico y piezas a revisar." />

      {data.vehicles.length>0 && (
        <div style={{ marginBottom:16 }}>
          <label style={{ fontSize:12, fontWeight:600, color:C.textSm, display:"block", marginBottom:6 }}>Cargar datos de vehículo registrado</label>
          <select onChange={e=>quickFill(e.target.value)} style={{...IS(), maxWidth:340}}>
            <option value="">— Seleccionar vehículo —</option>
            {data.vehicles.map(v=><option key={v.id} value={v.id}>{v.plate} · {v.year} {v.brand} {v.model}</option>)}
          </select>
        </div>
      )}

      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"24px", marginBottom:20 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:14 }}>
          <Field label="Marca"><input value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Toyota" style={IS()} /></Field>
          <Field label="Modelo"><input value={model} onChange={e=>setModel(e.target.value)} placeholder="Corolla" style={IS()} /></Field>
          <Field label="Año"><input value={year} onChange={e=>setYear(e.target.value)} placeholder="2018" style={IS()} /></Field>
          <Field label="Kilometraje"><input value={km} onChange={e=>setKm(e.target.value)} placeholder="87000" style={IS()} /></Field>
        </div>
        <Field label="Problema reportado por el cliente *">
          <textarea value={problem} onChange={e=>setProblem(e.target.value)} rows={3} placeholder="Ej: El carro tiembla al frenar a alta velocidad, hace un ruido metálico al girar a la derecha y la luz de ABS está encendida…" style={{...IS(),resize:"vertical"}} />
        </Field>
        <div style={{ marginTop:12 }}>
          <Field label="Códigos OBD (opcional)">
            <input value={codes} onChange={e=>setCodes(e.target.value)} placeholder="P0300, P0420…" style={IS()} />
          </Field>
        </div>
        <button onClick={run} disabled={loading||!problem.trim()} style={{ marginTop:16, padding:"12px 28px", borderRadius:10, border:"none", background: loading||!problem.trim()?C.border:C.blue, color:"#fff", fontWeight:700, fontSize:15, cursor:loading||!problem.trim()?"default":"pointer", display:"flex", alignItems:"center", gap:10 }}>
          {loading ? <><Spinner />Analizando…</> : "🤖 Analizar con IA"}
        </button>
      </div>

      {result && <AIResultBox title="Diagnóstico IA" content={result} color={C.purple} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   AI QUOTE PAGE
═══════════════════════════════════════════════════ */
function AIQuotePage({ data }) {
  const [clientId,    setClientId]    = useState("");
  const [vehicleId,   setVehicleId]   = useState("");
  const [services,    setServices]    = useState([]);
  const [extraNotes,  setExtraNotes]  = useState("");
  const [result,      setResult]      = useState(null);
  const [loading,     setLoading]     = useState(false);

  const client  = data.clients.find(c=>c.id===clientId);
  const vehicle = data.vehicles.find(v=>v.id===vehicleId);
  const clientVehicles = data.vehicles.filter(v=>v.clientId===clientId);

  const toggleSvc = (id) => setServices(p=>p.includes(id)?p.filter(s=>s!==id):[...p,id]);

  const total = services.reduce((s,id)=>s+((data.services||SERVICES_CAT).find(x=>x.id===id)?.price||0),0);

  const run = async () => {
    if (!services.length) return;
    setLoading(true); setResult(null);
    const svcList = services.map(id=>{ const s=(data.services||SERVICES_CAT).find(x=>x.id===id); return `- ${s.name}: ${fmtCRC(s.price)}`; }).join("\n");
    const sys = `Eres un asistente de taller automotriz profesional. Redactas presupuestos claros, amables y profesionales en español para clientes costarricenses. El taller se llama Tecno AutoAsisten CR. Usa un tono cordial pero profesional.`;
    const msg = `Redacta un presupuesto profesional para:\n\nCliente: ${client?.name||"Cliente"}\nVehículo: ${vehicle?`${vehicle.year} ${vehicle.brand} ${vehicle.model} placa ${vehicle.plate}`:"No especificado"}\n\nServicios cotizados:\n${svcList}\n\nTotal: ${fmtCRC(total)}\n\nNotas adicionales: ${extraNotes||"Ninguna"}\n\nIncluye: saludo, descripción de servicios, precio, tiempo estimado, garantía estándar del taller y cierre cordial.`;
    try {
      const r = await callClaude(sys, msg);
      setResult(r);
    } catch { setResult("Error al generar el presupuesto. Intenta nuevamente."); }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth:800, margin:"0 auto" }}>
      <AIPageHeader icon="💬" title="Generador de Presupuesto IA" desc="Selecciona cliente, vehículo y servicios. La IA redacta un presupuesto profesional listo para enviar." />

      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"24px", marginBottom:20 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
          <Field label="Cliente">
            <select value={clientId} onChange={e=>{ setClientId(e.target.value); setVehicleId(""); }} style={IS()}>
              <option value="">— Seleccionar cliente —</option>
              {data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Vehículo">
            <select value={vehicleId} onChange={e=>setVehicleId(e.target.value)} style={IS()} disabled={!clientId}>
              <option value="">— Seleccionar vehículo —</option>
              {clientVehicles.map(v=><option key={v.id} value={v.id}>{v.plate} · {v.brand} {v.model}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Servicios a cotizar *">
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:6 }}>
            {(data.services||SERVICES_CAT).map(s=>{
              const sel=services.includes(s.id);
              return <button key={s.id} onClick={()=>toggleSvc(s.id)} style={{ padding:"7px 13px", borderRadius:8, border:`1px solid ${sel?C.green:C.border}`, background:sel?`${C.green}18`:"transparent", color:sel?C.green:C.textMd, cursor:"pointer", fontSize:12, fontWeight:sel?700:400 }}>{s.name} · {fmtCRC(s.price)}</button>;
            })}
          </div>
        </Field>

        {services.length>0 && (
          <div style={{ background:C.bg, borderRadius:10, padding:"12px 16px", marginTop:14, display:"flex", justifyContent:"space-between" }}>
            <span style={{ color:C.textMd, fontSize:14 }}>Total cotizado ({services.length} servicios)</span>
            <span style={{ fontWeight:800, fontSize:18, color:C.green }}>{fmtCRC(total)}</span>
          </div>
        )}

        <div style={{ marginTop:14 }}>
          <Field label="Notas adicionales para el presupuesto">
            <textarea value={extraNotes} onChange={e=>setExtraNotes(e.target.value)} rows={2} placeholder="Tiempo estimado, condiciones especiales, descuentos…" style={{...IS(),resize:"vertical"}} />
          </Field>
        </div>

        <button onClick={run} disabled={loading||services.length===0} style={{ marginTop:16, padding:"12px 28px", borderRadius:10, border:"none", background:loading||!services.length?C.border:C.green, color:"#fff", fontWeight:700, fontSize:15, cursor:loading||!services.length?"default":"pointer", display:"flex", alignItems:"center", gap:10 }}>
          {loading ? <><Spinner />Generando…</> : "💬 Generar presupuesto con IA"}
        </button>
      </div>

      {result && <AIResultBox title="Presupuesto generado" content={result} color={C.green} copyable />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   AI MANUAL PAGE
═══════════════════════════════════════════════════ */
function AIManualPage({ data }) {
  const [bookId,   setBookId]   = useState("");
  const [question, setQuestion] = useState("");
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const endRef = useRef(null);

  const lib = data.library || [];
  const book = lib.find(b=>b.id===bookId);

  const send = async () => {
    if (!question.trim()) return;
    const q = question.trim();
    setQuestion("");
    setHistory(h=>[...h,{ role:"user", content:q }]);
    setLoading(true);

    const context = book
      ? `El usuario está consultando sobre el vehículo: ${book.brand} ${book.model} ${book.year}. Documento de referencia: "${book.title}" (${book.category}).`
      : "El usuario hace una consulta técnica general de mecánica automotriz.";

    const sys = `Eres un experto en mecánica automotriz con acceso a manuales técnicos. ${context} Respondes en español claro y técnico. Citas procedimientos específicos, torques, especificaciones y pasos cuando los conoces. Si no tienes información exacta del manual, lo indicas y das orientación general basada en tu conocimiento.`;

    const msgs = [...history, { role:"user", content:q }].map(m=>({ role:m.role, content:m.content }));

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000, system:sys, messages:msgs })
      });
      const d = await res.json();
      const answer = d.content?.map(b=>b.text||"").join("") || "Sin respuesta";
      setHistory(h=>[...h,{ role:"assistant", content:answer }]);
    } catch {
      setHistory(h=>[...h,{ role:"assistant", content:"Error al conectar. Intenta nuevamente." }]);
    }
    setLoading(false);
    setTimeout(()=>endRef.current?.scrollIntoView({ behavior:"smooth" }),100);
  };

  const quickQ = (q) => { setQuestion(q); };

  return (
    <div style={{ maxWidth:800, margin:"0 auto", display:"flex", flexDirection:"column", height:"calc(100vh - 160px)" }}>
      <AIPageHeader icon="📖" title="Consulta de Manuales con IA" desc="Selecciona un manual de tu biblioteca y hazle preguntas técnicas. La IA responde como si leyera el documento." />

      <Field label="Manual de referencia (opcional)">
        <select value={bookId} onChange={e=>{ setBookId(e.target.value); setHistory([]); }} style={{...IS(), marginBottom:16, maxWidth:400}}>
          <option value="">— Consulta general sin manual —</option>
          {lib.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
      </Field>

      {lib.length===0 && (
        <div style={{ background:`${C.amber}11`, border:`1px solid ${C.amber}44`, borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:13, color:C.amber }}>
          💡 No tienes manuales en la biblioteca aún. Puedes usarla como asistente técnico general igualmente.
        </div>
      )}

      {/* Quick questions */}
      {history.length===0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, color:C.textSm, marginBottom:8 }}>Preguntas frecuentes:</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {["¿Cuál es el torque de apriete de las ruedas?","¿Qué aceite recomienda para este motor?","¿Cómo resetear la luz de servicio?","¿Cuál es el intervalo de cambio de banda de tiempo?","Procedimiento para sangrado de frenos"].map(q=>(
              <button key={q} onClick={()=>quickQ(q)} style={{ padding:"6px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.textMd, cursor:"pointer", fontSize:12 }}>{q}</button>
            ))}
          </div>
        </div>
      )}

      {/* Chat history */}
      <div style={{ flex:1, overflowY:"auto", border:`1px solid ${C.border}`, borderRadius:12, padding:"16px", marginBottom:14, background:C.card, display:"flex", flexDirection:"column", gap:14 }}>
        {history.length===0 && <div style={{ color:C.textSm, fontSize:13, textAlign:"center", marginTop:20 }}>Haz tu primera pregunta técnica 👆</div>}
        {history.map((m,i)=>(
          <div key={i} style={{ display:"flex", gap:10, justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
            {m.role==="assistant" && <div style={{ width:28, height:28, borderRadius:"50%", background:`linear-gradient(135deg,${C.purple},${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🤖</div>}
            <div style={{ maxWidth:"78%", background: m.role==="user"?`${C.blue}22`:C.bg, border:`1px solid ${m.role==="user"?C.blue:C.border}`, borderRadius:12, padding:"10px 14px", fontSize:13, lineHeight:1.6, whiteSpace:"pre-wrap" }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", gap:10 }}>
            <div style={{ width:28, height:28, borderRadius:"50%", background:`linear-gradient(135deg,${C.purple},${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🤖</div>
            <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:8, color:C.textMd, fontSize:13 }}><Spinner />Buscando en el manual…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ display:"flex", gap:10 }}>
        <input
          value={question}
          onChange={e=>setQuestion(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey&&!loading) { e.preventDefault(); send(); } }}
          placeholder="Escribe tu pregunta técnica… (Enter para enviar)"
          style={{...IS(), flex:1, padding:"12px 16px"}}
        />
        <button onClick={send} disabled={loading||!question.trim()} style={{ padding:"12px 20px", borderRadius:10, border:"none", background:loading||!question.trim()?C.border:C.purple, color:"#fff", fontWeight:700, cursor:loading||!question.trim()?"default":"pointer", fontSize:15 }}>→</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   AI SHARED COMPONENTS
═══════════════════════════════════════════════════ */
function AIPageHeader({ icon, title, desc }) {
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:`linear-gradient(135deg,${C.purple},${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{icon}</div>
        <div>
          <div style={{ fontWeight:800, fontSize:20 }}>{title}</div>
          <div style={{ fontSize:13, color:C.textMd }}>{desc}</div>
        </div>
      </div>
      <div style={{ background:`${C.purple}11`, border:`1px solid ${C.purple}33`, borderRadius:8, padding:"8px 14px", fontSize:12, color:C.purple }}>
        ✨ Potenciado por Claude AI · Las sugerencias son orientativas. Valida siempre con criterio técnico profesional.
      </div>
    </div>
  );
}

function AIResultBox({ title, content, color, copyable }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(content).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); }); };
  return (
    <div style={{ background:C.card, border:`1px solid ${color}44`, borderRadius:14, padding:"22px 24px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontWeight:700, fontSize:15, color }}>{title}</div>
        {copyable && <button onClick={copy} style={{ padding:"6px 14px", borderRadius:8, border:`1px solid ${color}44`, background:`${color}11`, color, cursor:"pointer", fontSize:12, fontWeight:600 }}>{copied?"✓ Copiado":"📋 Copiar"}</button>}
      </div>
      <div style={{ fontSize:13, lineHeight:1.8, whiteSpace:"pre-wrap", color:C.text }}>{content}</div>
    </div>
  );
}

function Spinner() {
  return <span style={{ display:"inline-block", width:14, height:14, border:"2px solid #ffffff44", borderTop:"2px solid #fff", borderRadius:"50%", animation:"spin .7s linear infinite" }}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </span>;
}


/* ═══════════════════════════════════════════════════
   AUTH PAGE — Login / Registro con aprobación manual
═══════════════════════════════════════════════════ */
function AuthPage({ onLogin }) {
  const [mode,     setMode]     = useState("login"); // "login" | "register" | "forgot"
  const [name,     setName]     = useState("");
  const [phone,    setPhone]    = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [pending,  setPending]  = useState(false);
  const [resetSent,setResetSent]= useState(false);

  const handleForgotPassword = async () => {
    setError("");
    if (!email.trim()) { setError("Ingresá tu correo electrónico."); return; }
    setLoading(true);
    try {
      await auth.resetPassword(email.trim());
      setResetSent(true);
    } catch(e) {
      setError("Error de conexión. Intentá de nuevo.");
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password.trim()) { setError("Ingresá tu correo y contraseña."); return; }
    if (mode === "register") {
      if (!name.trim())  { setError("Ingresá tu nombre completo."); return; }
      if (!phone.trim()) { setError("Ingresá tu número de teléfono."); return; }
      if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
      if (password.length < 6)  { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    }

    setLoading(true);
    try {
      if (mode === "register") {
        // 1. Create auth user
        const res = await auth.signUp(email.trim(), password);
        if (res.error) { setError(res.error.message || "Error al registrarse."); setLoading(false); return; }

        // 2. Save profile in pending_users table
        const userId = res.user?.id || res.id;
        if (userId) {
          await fetch(`${SB_URL}/rest/v1/pending_users`, {
            method: "POST",
            headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ id: userId, name: name.trim(), phone: phone.trim(), email: email.trim(), status: "pending", role: "client", created_at: new Date().toISOString() })
          });
        }
        setPending(true);

      } else {
        // LOGIN — check if approved first
        const res = await auth.signIn(email.trim(), password);
        if (res.error || !res.access_token) {
          setError(res.error?.message || "Correo o contraseña incorrectos.");
          setLoading(false); return;
        }

        // Check approval status
        const userId = res.user?.id;
        const checkRes = await fetch(`${SB_URL}/rest/v1/pending_users?id=eq.${userId}&select=status,name`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${res.access_token}` }
        });
        const userRows = await checkRes.json();
        const userRow  = userRows?.[0];

        if (!userRow) {
          // No pending_users record = admin account, allow in
          onLogin(res.access_token, res.user?.email || email.trim(), "admin");
        } else if (userRow.status === "approved") {
          onLogin(res.access_token, userRow.name || res.user?.email, userRow.role || "client");
        } else if (userRow.status === "pending") {
          setError("Tu cuenta está pendiente de aprobación. El administrador te confirmará pronto.");
        } else {
          setError("Tu cuenta fue rechazada. Contactá al administrador.");
        }
      }
    } catch(e) {
      setError("Error de conexión. Verificá tu internet.");
    }
    setLoading(false);
  };

  if (pending) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',system-ui,sans-serif", padding:20 }}>
      <div style={{ maxWidth:420, textAlign:"center" }}>
        <div style={{ fontSize:64, marginBottom:20 }}>⏳</div>
        <div style={{ fontWeight:800, fontSize:22, color:C.text, marginBottom:12 }}>Solicitud enviada</div>
        <div style={{ color:C.textMd, fontSize:15, lineHeight:1.7, background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 24px" }}>
          Tu cuenta fue creada y está <strong style={{ color:C.amber }}>pendiente de aprobación</strong>.<br/><br/>
          El administrador del taller revisará tu solicitud y te dará acceso.<br/><br/>
          <span style={{ fontSize:13, color:C.textSm }}>Si ya fuiste aprobado, intentá iniciar sesión.</span>
        </div>
        <button onClick={()=>{ setPending(false); setMode("login"); setPassword(""); setConfirm(""); }} style={{ marginTop:20, padding:"11px 28px", borderRadius:10, border:"none", background:C.blue, color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer" }}>
          Ir a iniciar sesión
        </button>
      </div>
    </div>
  );

  if (mode === "forgot") return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',system-ui,sans-serif", padding:20 }}>
      <div style={{ width:"100%", maxWidth:420 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:60, height:60, background:`linear-gradient(135deg,${C.blue},${C.cyan})`, borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, margin:"0 auto 14px" }}>🔑</div>
          <div style={{ fontWeight:800, fontSize:22, color:C.text }}>Recuperar contraseña</div>
          <div style={{ fontSize:13, color:C.textSm, marginTop:6 }}>Te enviaremos un enlace a tu correo para restablecerla</div>
        </div>

        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:"32px 28px" }}>
          {resetSent ? (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:48, marginBottom:14 }}>📩</div>
              <div style={{ color:C.green, fontWeight:700, fontSize:16, marginBottom:8 }}>¡Correo enviado!</div>
              <div style={{ color:C.textMd, fontSize:14, lineHeight:1.6 }}>
                Revisá tu bandeja de entrada (y spam) en <strong style={{color:C.text}}>{email}</strong>. Seguí el enlace para crear una nueva contraseña.
              </div>
              <button onClick={()=>{ setMode("login"); setResetSent(false); setEmail(""); }} style={{ marginTop:20, width:"100%", padding:"12px", borderRadius:10, border:"none", background:C.blue, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>
                Volver a iniciar sesión
              </button>
            </div>
          ) : (
            <>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:C.textSm, display:"block", marginBottom:5 }}>Correo electrónico</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleForgotPassword()} placeholder="tucorreo@email.com" style={{...IS(), padding:"12px 14px"}} />
              </div>
              {error && <div style={{ marginTop:14, background:"#2D0000", border:`1px solid ${C.red}44`, borderRadius:8, padding:"10px 14px", fontSize:13, color:C.red }}>❌ {error}</div>}
              <button onClick={handleForgotPassword} disabled={loading} style={{ marginTop:20, width:"100%", padding:"13px", borderRadius:10, border:"none", background:loading?C.border:`linear-gradient(135deg,${C.blue},${C.cyan})`, color:"#fff", fontWeight:700, fontSize:15, cursor:loading?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                {loading ? <><Spinner />Enviando…</> : "Enviar enlace de recuperación →"}
              </button>
              <button onClick={()=>{ setMode("login"); setError(""); }} style={{ marginTop:14, width:"100%", padding:"10px", borderRadius:10, border:"none", background:"transparent", color:C.textMd, fontSize:13, cursor:"pointer" }}>
                ← Volver a iniciar sesión
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',system-ui,sans-serif", padding:20 }}>
      <div style={{ width:"100%", maxWidth:440 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:60, height:60, background:`linear-gradient(135deg,${C.blue},${C.cyan})`, borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, margin:"0 auto 14px" }}>🔧</div>
          <div style={{ fontWeight:800, fontSize:24, color:C.text }}>Tecno AutoAsisten <span style={{ color:C.blueHi }}>CR</span></div>
          <div style={{ fontSize:13, color:C.textSm, marginTop:4 }}>Sistema de Gestión del Taller</div>
        </div>

        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:"32px 28px" }}>
          {/* Tabs */}
          <div style={{ display:"flex", gap:4, background:C.bg, borderRadius:10, padding:4, marginBottom:24 }}>
            {[["login","Iniciar sesión"],["register","Solicitar acceso"]].map(([m,l])=>(
              <button key={m} onClick={()=>{ setMode(m); setError(""); }} style={{ flex:1, padding:"9px", borderRadius:8, border:"none", cursor:"pointer", background:mode===m?C.blue:"transparent", color:mode===m?"#fff":C.textMd, fontWeight:mode===m?700:400, fontSize:13, transition:"all .15s" }}>{l}</button>
            ))}
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            {mode==="register" && <>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:C.textSm, display:"block", marginBottom:5 }}>Nombre completo *</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Juan Pérez" style={{...IS(), padding:"12px 14px"}} />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:C.textSm, display:"block", marginBottom:5 }}>Teléfono *</label>
                <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="8800-0000" style={{...IS(), padding:"12px 14px"}} />
              </div>
            </>}
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:C.textSm, display:"block", marginBottom:5 }}>Correo electrónico *</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="tucorreo@email.com" style={{...IS(), padding:"12px 14px"}} />
            </div>
            <div>
              <label style={{ fontSize:12, fontWeight:600, color:C.textSm, display:"block", marginBottom:5 }}>Contraseña *</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="Mínimo 6 caracteres" style={{...IS(), padding:"12px 14px"}} />
            </div>
            {mode==="register" && (
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:C.textSm, display:"block", marginBottom:5 }}>Confirmar contraseña *</label>
                <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="Repetí la contraseña" style={{...IS(), padding:"12px 14px"}} />
              </div>
            )}
          </div>

          {error && <div style={{ marginTop:14, background:"#2D0000", border:`1px solid ${C.red}44`, borderRadius:8, padding:"10px 14px", fontSize:13, color:C.red }}>❌ {error}</div>}

          {mode==="register" && (
            <div style={{ marginTop:14, background:`${C.amber}11`, border:`1px solid ${C.amber}33`, borderRadius:8, padding:"10px 14px", fontSize:12, color:C.amber }}>
              ⚠️ Tu cuenta será revisada por el administrador antes de activarse.
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading} style={{ marginTop:20, width:"100%", padding:"13px", borderRadius:10, border:"none", background:loading?C.border:`linear-gradient(135deg,${C.blue},${C.cyan})`, color:"#fff", fontWeight:700, fontSize:16, cursor:loading?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            {loading ? <><Spinner />{mode==="login"?"Entrando…":"Enviando solicitud…"}</> : mode==="login" ? "Entrar al sistema →" : "Enviar solicitud →"}
          </button>

          {mode==="login" && (
            <button onClick={()=>{ setMode("forgot"); setError(""); }} style={{ marginTop:14, width:"100%", padding:"6px", background:"none", border:"none", color:C.blueHi, fontSize:13, cursor:"pointer", textAlign:"center" }}>
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </div>

        <div style={{ textAlign:"center", marginTop:16, fontSize:12, color:C.textSm }}>
          🔒 Acceso controlado · Solo personal autorizado por el taller
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   USERS PAGE — Aprobación de cuentas
═══════════════════════════════════════════════════ */
function UsersPage({ session }) {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast2,  setToast2]  = useState(null);

  const showMsg = (msg, type="ok") => { setToast2({msg,type}); setTimeout(()=>setToast2(null),3000); };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const tk = localStorage.getItem("tac_token") || SB_KEY;
      const r  = await fetch(`${SB_URL}/rest/v1/pending_users?order=created_at.desc`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${tk}` }
      });
      const data = await r.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch(e) { setUsers([]); }
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const updateStatus = async (id, status) => {
    const tk = localStorage.getItem("tac_token") || SB_KEY;
    await fetch(`${SB_URL}/rest/v1/pending_users?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${tk}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status, role: status === "approved" ? "client" : undefined })
    });
    showMsg(status === "approved" ? "Usuario aprobado ✓" : "Usuario rechazado");
    loadUsers();
  };

  const deleteUser = async (id) => {
    const tk = localStorage.getItem("tac_token") || SB_KEY;
    await fetch(`${SB_URL}/rest/v1/pending_users?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${tk}` }
    });
    showMsg("Usuario eliminado", "err");
    loadUsers();
  };

  const STATUS_CFG = {
    pending:  { label:"Pendiente",  color:C.amber,  bg:"#2D1A00" },
    approved: { label:"Aprobado",   color:C.green,  bg:"#002D1A" },
    rejected: { label:"Rechazado",  color:C.red,    bg:"#2D0000" },
  };

  const counts = {
    pending:  users.filter(u=>u.status==="pending").length,
    approved: users.filter(u=>u.status==="approved").length,
    rejected: users.filter(u=>u.status==="rejected").length,
  };

  return (
    <div>
      <div style={{ fontWeight:800, fontSize:22, marginBottom:6 }}>🔐 Gestión de Usuarios</div>
      <div style={{ color:C.textMd, fontSize:14, marginBottom:24 }}>Aprobá o rechazá las solicitudes de acceso al sistema.</div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24 }}>
        {[["pending","Pendientes",C.amber],["approved","Aprobados",C.green],["rejected","Rechazados",C.red]].map(([k,l,color])=>(
          <div key={k} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 18px" }}>
            <div style={{ fontSize:11, color:C.textSm, textTransform:"uppercase", letterSpacing:.7 }}>{l}</div>
            <div style={{ fontSize:26, fontWeight:800, color, marginTop:5 }}>{counts[k]}</div>
          </div>
        ))}
      </div>

      {loading && <div style={{ color:C.textSm, textAlign:"center", padding:40 }}>Cargando usuarios…</div>}

      {!loading && users.length === 0 && (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:40, textAlign:"center", color:C.textSm }}>
          No hay solicitudes de acceso aún.
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {users.map(u => {
          const sc = STATUS_CFG[u.status] || STATUS_CFG.pending;
          return (
            <div key={u.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 20px", display:"flex", gap:16, alignItems:"center", flexWrap:"wrap" }}>
              {/* Avatar */}
              <div style={{ width:46, height:46, borderRadius:"50%", background:`linear-gradient(135deg,${C.blue},${C.cyan})`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:18, color:"#fff", flexShrink:0 }}>
                {(u.name||"?").charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex:1, minWidth:160 }}>
                <div style={{ fontWeight:700, fontSize:15 }}>{u.name || "Sin nombre"}</div>
                <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>✉️ {u.email}</div>
                <div style={{ fontSize:12, color:C.textSm, marginTop:1 }}>📱 {u.phone || "Sin teléfono"}</div>
                <div style={{ fontSize:11, color:C.textSm, marginTop:1 }}>
                  {u.created_at ? `Solicitó el ${new Date(u.created_at).toLocaleDateString("es-CR")}` : ""}
                </div>
              </div>

              {/* Status */}
              <Pill label={sc.label} color={sc.color} bg={sc.bg} />

              {/* Actions */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {u.status !== "approved" && (
                  <button onClick={()=>updateStatus(u.id,"approved")} style={{ padding:"8px 16px", borderRadius:8, border:`1px solid ${C.green}44`, background:`${C.green}18`, color:C.green, fontWeight:700, fontSize:13, cursor:"pointer" }}>
                    ✅ Aprobar
                  </button>
                )}
                {u.status !== "rejected" && (
                  <button onClick={()=>updateStatus(u.id,"rejected")} style={{ padding:"8px 16px", borderRadius:8, border:`1px solid ${C.red}44`, background:`${C.red}18`, color:C.red, fontWeight:700, fontSize:13, cursor:"pointer" }}>
                    ❌ Rechazar
                  </button>
                )}
                {u.status === "approved" && (
                  <button onClick={()=>updateStatus(u.id,"pending")} style={{ padding:"8px 16px", borderRadius:8, border:`1px solid ${C.amber}44`, background:`${C.amber}18`, color:C.amber, fontWeight:600, fontSize:13, cursor:"pointer" }}>
                    ⏸ Suspender
                  </button>
                )}
                <button onClick={()=>deleteUser(u.id)} style={{ padding:"8px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.textSm, fontSize:13, cursor:"pointer" }}>
                  🗑
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Refresh button */}
      <button onClick={loadUsers} style={{ marginTop:20, padding:"10px 20px", borderRadius:9, border:`1px solid ${C.border}`, background:"transparent", color:C.textMd, cursor:"pointer", fontSize:13 }}>
        🔄 Actualizar lista
      </button>

      {/* Toast */}
      {toast2 && (
        <div style={{ position:"fixed", bottom:28, right:28, background:toast2.type==="ok"?C.green:C.red, color:"#fff", borderRadius:10, padding:"12px 20px", fontWeight:600, fontSize:14, zIndex:9999 }}>
          {toast2.msg}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   CLIENT PORTAL — Vista para clientes
═══════════════════════════════════════════════════ */
function ClientPortal({ session, onLogout }) {
  const [tab,        setTab]        = useState("appointments");
  const [clients,    setClients]    = useState([]);
  const [vehicles,   setVehicles]   = useState([]);
  const [orders,     setOrders]     = useState([]);
  const [appts,      setAppts]      = useState([]);
  const [myClient,   setMyClient]   = useState(null);
  const [loading,    setLoading]    = useState(true);

  // New appointment form
  const [apptForm,   setApptForm]   = useState({ vehicleId:"", serviceId:"diag", date:today(), hour:"9:00", notes:"" });
  const [apptDone,   setApptDone]   = useState(false);
  const [apptLoading,setApptLoading]= useState(false);
  const [workers,    setWorkers]    = useState([]);
  const [services,   setServices]   = useState(SERVICES_CAT);
  const [myQuotes,   setMyQuotes]   = useState([]);

  // Quote request form
  const [quoteDesc,    setQuoteDesc]    = useState("");
  const [quoteVehicle, setQuoteVehicle] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteDone,    setQuoteDone]    = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [cls, vhs, ords, apts, wks, svcs, qts] = await Promise.all([
        sb.get("clients"), sb.get("vehicles"), sb.get("orders"), sb.get("appointments"), sb.get("workers"), sb.get("services"), sb.get("quotes")
      ]);
      const allClients  = (cls||[]).map(TABLE.clients.fromDb);
      const allVehicles = (vhs||[]).map(TABLE.vehicles.fromDb);
      const allOrders   = (ords||[]).map(TABLE.orders.fromDb);
      const allAppts    = (apts||[]).map(TABLE.appointments.fromDb);
      const allWorkers  = (wks||[]).map(TABLE.workers.fromDb);
      const allServices = (svcs||[]).map(TABLE.services.fromDb);
      const allQuotes   = (qts||[]).map(TABLE.quotes.fromDb);
      if (allServices.length) setServices(allServices);

      // Match client by email or name
      const me = allClients.find(c =>
        c.email?.toLowerCase() === session.email?.toLowerCase() ||
        c.name?.toLowerCase()  === session.email?.toLowerCase()
      );

      setMyClient(me || null);
      setClients(allClients);
      setVehicles(me ? allVehicles.filter(v=>v.clientId===me.id) : []);
      setOrders(me   ? allOrders.filter(o=>o.clientId===me.id)   : []);
      setAppts(me    ? allAppts.filter(a=>a.clientId===me.id)     : []);
      setMyQuotes(me ? allQuotes.filter(q=>q.clientId===me.id)    : []);
      setWorkers(allWorkers.filter(w=>w.status==="active"));
      if (me && allVehicles.filter(v=>v.clientId===me.id).length > 0) {
        const firstVeh = allVehicles.filter(v=>v.clientId===me.id)[0].id;
        setApptForm(f=>({...f, vehicleId: firstVeh }));
        setQuoteVehicle(firstVeh);
      }
      setLoading(false);
    })();
  }, []);

  const submitQuote = async () => {
    if (!myClient || !quoteDesc.trim()) return;
    setQuoteLoading(true);
    const newQuote = {
      id: uid(), clientId: myClient.id, vehicleId: quoteVehicle || null,
      description: quoteDesc.trim(), status: "pending", services: [], total: 0,
      notes: "", createdAt: new Date().toISOString()
    };
    await sb.upsert("quotes", TABLE.quotes.toDb(newQuote));
    setMyQuotes(prev => [...prev, newQuote]);
    setQuoteDesc("");
    setQuoteDone(true);
    setQuoteLoading(false);
    setTimeout(()=>setQuoteDone(false), 4000);
  };

  const bookAppointment = async () => {
    if (!myClient) return;
    if (!apptForm.vehicleId || !apptForm.date) return;
    setApptLoading(true);
    const newAppt = {
      id: uid(), clientId: myClient.id, vehicleId: apptForm.vehicleId,
      serviceId: apptForm.serviceId, date: apptForm.date, hour: apptForm.hour,
      status: "pending", notes: apptForm.notes,
      mechanic: workers[0]?.name || ""
    };
    await sb.upsert("appointments", TABLE.appointments.toDb(newAppt));
    setAppts(prev => [...prev, newAppt]);
    setApptDone(true);
    setApptLoading(false);
    setTimeout(()=>setApptDone(false), 4000);
  };

  const TABS = [
    { id:"appointments", icon:"📅", label:"Mis citas" },
    { id:"book",         icon:"➕", label:"Agendar cita" },
    { id:"quote",        icon:"💬", label:"Cotizar" },
    { id:"orders",       icon:"📋", label:"Mis órdenes" },
    { id:"vehicles",     icon:"🚗", label:"Mis vehículos" },
  ];

  if (loading) return <Loader />;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Inter',system-ui,sans-serif" }}>
      {/* Header */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 24px", height:60, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, background:`linear-gradient(135deg,${C.blue},${C.cyan})`, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🔧</div>
          <div>
            <div style={{ fontWeight:700, fontSize:14 }}>Tecno AutoAsisten <span style={{ color:C.blueHi }}>CR</span></div>
            <div style={{ fontSize:10, color:C.textSm }}>Portal de Clientes</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:12, color:C.textSm }}>👤 {session.email}</span>
          <button onClick={onLogout} style={{ fontSize:12, color:C.red, background:"none", border:`1px solid ${C.red}44`, borderRadius:8, padding:"5px 12px", cursor:"pointer", fontWeight:600 }}>Salir</button>
        </div>
      </div>

      <div style={{ maxWidth:700, margin:"0 auto", padding:"28px 20px" }}>

        {/* Welcome */}
        {myClient && (
          <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 20px", marginBottom:24, display:"flex", gap:14, alignItems:"center" }}>
            <div style={{ width:44, height:44, borderRadius:"50%", background:`linear-gradient(135deg,${C.blue},${C.cyan})`, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:20, color:"#fff" }}>
              {myClient.name.charAt(0)}
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>Bienvenido, {myClient.name}</div>
              <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>{vehicles.length} vehículo(s) · {appts.length} cita(s) · {orders.length} orden(es)</div>
            </div>
          </div>
        )}

        {!myClient && (
          <div style={{ background:`${C.amber}11`, border:`1px solid ${C.amber}44`, borderRadius:12, padding:"16px 20px", marginBottom:24, fontSize:14, color:C.amber }}>
            ⚠️ Tu perfil de cliente no está vinculado aún. Contactá al taller para que te registren en el sistema.
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:"flex", gap:6, marginBottom:24, background:C.card, borderRadius:12, padding:6 }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, padding:"9px 6px", borderRadius:8, border:"none", cursor:"pointer", background:tab===t.id?C.blue:"transparent", color:tab===t.id?"#fff":C.textMd, fontWeight:tab===t.id?700:400, fontSize:12, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
              <span style={{ fontSize:16 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* MIS CITAS */}
        {tab==="appointments" && (
          <div>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:16 }}>Mis citas</div>
            {appts.length===0 && <Empty msg="No tenés citas registradas" />}
            {[...appts].sort((a,b)=>b.date.localeCompare(a.date)).map(a=>{
              const svc = services.find(s=>s.id===a.serviceId);
              const sc  = STATUS_COLORS[a.status] || STATUS_COLORS.pending;
              return (
                <div key={a.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px", marginBottom:10, display:"flex", gap:14, alignItems:"center" }}>
                  <div style={{ background:C.bg, borderRadius:8, padding:"8px 12px", textAlign:"center", minWidth:58, flexShrink:0 }}>
                    <div style={{ fontSize:10, color:C.textSm }}>{fmtDate(a.date)}</div>
                    <div style={{ fontWeight:700, color:C.blueHi, fontSize:14 }}>{a.hour}</div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:14 }}>{svc?.name || a.serviceId}</div>
                    <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>{a.mechanic && `Mecánico: ${a.mechanic}`}</div>
                    {a.notes && <div style={{ fontSize:11, color:C.textSm }}>💬 {a.notes}</div>}
                  </div>
                  <Pill label={sc.label} color={sc.color} bg={sc.bg} />
                </div>
              );
            })}
          </div>
        )}

        {/* AGENDAR CITA */}
        {tab==="book" && (
          <div>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:16 }}>Agendar una cita</div>
            {!myClient && <div style={{ color:C.red, fontSize:14 }}>Necesitás estar registrado como cliente para agendar.</div>}
            {myClient && vehicles.length===0 && <div style={{ color:C.amber, fontSize:14 }}>No tenés vehículos registrados. Contactá al taller.</div>}
            {myClient && vehicles.length>0 && (
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"24px" }}>
                {apptDone && (
                  <div style={{ background:"#002D1A", border:`1px solid ${C.green}44`, borderRadius:10, padding:"12px 16px", marginBottom:16, color:C.green, fontWeight:600 }}>
                    ✅ ¡Cita agendada! El taller confirmará pronto.
                  </div>
                )}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                  <Field label="Vehículo">
                    <select value={apptForm.vehicleId} onChange={e=>setApptForm(f=>({...f,vehicleId:e.target.value}))} style={IS()}>
                      {vehicles.map(v=><option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}
                    </select>
                  </Field>
                  <Field label="Servicio">
                    <select value={apptForm.serviceId} onChange={e=>setApptForm(f=>({...f,serviceId:e.target.value}))} style={IS()}>
                      {services.map(s=><option key={s.id} value={s.id}>{s.name} · {fmtCRC(s.price)}</option>)}
                    </select>
                  </Field>
                  <Field label="Fecha">
                    <input type="date" value={apptForm.date} min={today()} onChange={e=>setApptForm(f=>({...f,date:e.target.value}))} style={IS()} />
                  </Field>
                  <Field label="Hora">
                    <select value={apptForm.hour} onChange={e=>setApptForm(f=>({...f,hour:e.target.value}))} style={IS()}>
                      {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
                    </select>
                  </Field>
                </div>
                <div style={{ marginTop:14 }}>
                  <Field label="Notas / problema">
                    <textarea value={apptForm.notes} onChange={e=>setApptForm(f=>({...f,notes:e.target.value}))} rows={3} placeholder="Describí el problema o lo que necesitás revisar…" style={{...IS(),resize:"vertical"}} />
                  </Field>
                </div>
                <button onClick={bookAppointment} disabled={apptLoading} style={{ marginTop:18, width:"100%", padding:"13px", borderRadius:10, border:"none", background:apptLoading?C.border:`linear-gradient(135deg,${C.blue},${C.cyan})`, color:"#fff", fontWeight:700, fontSize:15, cursor:apptLoading?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                  {apptLoading ? <><Spinner />Agendando…</> : "📅 Confirmar cita"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* COTIZAR */}
        {tab==="quote" && (
          <div>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:16 }}>Solicitar cotización</div>

            {quoteDone && (
              <div style={{ background:"#002D1A", border:`1px solid ${C.green}44`, borderRadius:10, padding:"12px 16px", marginBottom:16, color:C.green, fontWeight:600 }}>
                ✅ ¡Solicitud enviada! El taller te enviará la cotización a la brevedad.
              </div>
            )}

            {!myClient && <div style={{ color:C.red, fontSize:14 }}>Necesitás estar registrado como cliente para solicitar una cotización.</div>}

            {myClient && (
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"24px" }}>
                {vehicles.length>0 && (
                  <Field label="Vehículo (opcional)">
                    <select value={quoteVehicle} onChange={e=>setQuoteVehicle(e.target.value)} style={IS()}>
                      <option value="">Sin especificar</option>
                      {vehicles.map(v=><option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}
                    </select>
                  </Field>
                )}
                <div style={{ marginTop:14 }}>
                  <Field label="Describí lo que necesitás cotizar *">
                    <textarea value={quoteDesc} onChange={e=>setQuoteDesc(e.target.value)} rows={4} placeholder="Ej: Necesito cotizar cambio de frenos delanteros y revisión del aire acondicionado…" style={{...IS(),resize:"vertical"}} />
                  </Field>
                </div>
                <button onClick={submitQuote} disabled={quoteLoading || !quoteDesc.trim()} style={{ marginTop:18, width:"100%", padding:"13px", borderRadius:10, border:"none", background:(quoteLoading||!quoteDesc.trim())?C.border:`linear-gradient(135deg,${C.blue},${C.cyan})`, color:"#fff", fontWeight:700, fontSize:15, cursor:(quoteLoading||!quoteDesc.trim())?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                  {quoteLoading ? <><Spinner />Enviando…</> : "💬 Solicitar cotización"}
                </button>
              </div>
            )}

            {/* Historial de cotizaciones */}
            {myQuotes.length > 0 && (
              <div style={{ marginTop:24 }}>
                <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>Mis cotizaciones</div>
                {[...myQuotes].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).map(q=>{
                  const sc = QUOTE_STATUS[q.status] || QUOTE_STATUS.pending;
                  return (
                    <div key={q.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px", marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, color:C.text }}>{q.description}</div>
                          {q.total > 0 && <div style={{ fontWeight:800, fontSize:16, color:C.green, marginTop:6 }}>{fmtCRC(q.total)}</div>}
                        </div>
                        <Pill label={sc.label} color={sc.color} bg={sc.bg} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* MIS ÓRDENES */}
        {tab==="orders" && (
          <div>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:16 }}>Mis órdenes de trabajo</div>
            {orders.length===0 && <Empty msg="No tenés órdenes registradas" />}
            {[...orders].sort((a,b)=>b.date.localeCompare(a.date)).map(o=>{
              const sc = ORDER_STATUS[o.status] || ORDER_STATUS.active;
              return (
                <div key={o.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 20px", marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14 }}>{fmtDate(o.date)}</div>
                      <div style={{ fontSize:12, color:C.textSm, marginTop:3 }}>
                        {o.services.map(sid=>services.find(s=>s.id===sid)?.name).filter(Boolean).join(", ")}
                      </div>
                      {o.mechanic && <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>Mecánico: {o.mechanic}</div>}
                      {o.notes && <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>💬 {o.notes}</div>}
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontWeight:800, fontSize:18, color:C.green }}>{fmtCRC(o.total)}</div>
                      <Pill label={sc.label} color={sc.color} bg={sc.bg} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MIS VEHÍCULOS */}
        {tab==="vehicles" && (
          <div>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:16 }}>Mis vehículos</div>
            {vehicles.length===0 && <Empty msg="No tenés vehículos registrados" />}
            {vehicles.map(v=>(
              <div key={v.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 20px", marginBottom:10 }}>
                <div style={{ fontWeight:700, fontSize:15 }}>{v.plate} — {v.year} {v.brand} {v.model}</div>
                <div style={{ fontSize:12, color:C.textSm, marginTop:4 }}>{v.color} · {v.fuel} · {Number(v.km).toLocaleString()} km</div>
                {v.vin && <div style={{ fontSize:11, color:C.textSm, marginTop:2 }}>VIN: {v.vin}</div>}
                {v.notes && <div style={{ fontSize:12, color:C.textSm, marginTop:4 }}>💬 {v.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SUBCONTRACTS PAGE — Servicios tercerizados
═══════════════════════════════════════════════════ */
function SubcontractsPage({ data, save, toast }) {
  const [modal, setModal] = useState(null);
  const [delId, setDelId] = useState(null);
  const [search, setSearch] = useState("");

  const subs = data.subcontracts || [];
  const filtered = subs.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.provider.toLowerCase().includes(search.toLowerCase())
  );

  const upsert = (item) => {
    const list = item.id ? subs.map(s=>s.id===item.id?item:s) : [...subs,{...item,id:uid()}];
    save({ subcontracts:list });
    toast(item.id?"Subcontratación actualizada":"Subcontratación agregada");
    setModal(null);
  };

  const del = (id) => { save({ subcontracts:subs.filter(s=>s.id!==id) }); toast("Eliminada","err"); setDelId(null); };

  const totalValue = subs.reduce((s,x)=>s+(x.price||0),0);

  return (
    <div>
      <PageHeader title={`Subcontrataciones (${subs.length})`} onNew={()=>setModal({mode:"new",item:{name:"",price:0,provider:"",leadTime:"",notes:""}})} newLabel="+ Nueva subcontratación" />

      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 18px", marginBottom:18, display:"inline-block" }}>
        <div style={{ fontSize:11, color:C.textSm, textTransform:"uppercase", letterSpacing:.7 }}>Valor total catalogado</div>
        <div style={{ fontSize:22, fontWeight:800, color:C.amber, marginTop:4 }}>{fmtCRC(totalValue)}</div>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Buscar por servicio o proveedor…" />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:14, marginTop:16 }}>
        {filtered.map(s=>(
          <div key={s.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 20px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15 }}>{s.name}</div>
                <div style={{ fontSize:12, color:C.blueHi, marginTop:3 }}>🏭 {s.provider || "Sin proveedor"}</div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <IBtn icon="✏️" onClick={()=>setModal({mode:"edit",item:s})} />
                <IBtn icon="🗑" red onClick={()=>setDelId(s.id)} />
              </div>
            </div>
            <div style={{ display:"flex", gap:12, marginTop:14, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
              <Stat label="Precio" value={fmtCRC(s.price)} />
              <Stat label="Entrega estimada" value={s.leadTime || "—"} />
            </div>
            {s.notes && <div style={{ marginTop:10, fontSize:12, color:C.textSm }}>💬 {s.notes}</div>}
          </div>
        ))}
        {filtered.length===0 && <Empty msg="No hay subcontrataciones registradas" />}
      </div>

      {modal && <SubcontractModal item={modal.item} onSave={upsert} onClose={()=>setModal(null)} />}
      {delId && <Confirm msg="¿Eliminar esta subcontratación?" onOk={()=>del(delId)} onCancel={()=>setDelId(null)} />}
    </div>
  );
}

function SubcontractModal({ item, onSave, onClose }) {
  const [f, setF] = useState(item);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  return (
    <Modal title={item.id?"Editar subcontratación":"Nueva subcontratación"} onClose={onClose}>
      <Field label="Nombre del servicio"><input value={f.name} onChange={e=>set("name",e.target.value)} style={IS()} placeholder="Pintura general, enderezado, polarizado…" /></Field>
      <div style={{ marginTop:14 }}>
        <Grid2>
          <Field label="Precio (₡)"><input type="number" value={f.price} onChange={e=>set("price",+e.target.value)} style={IS()} /></Field>
          <Field label="Proveedor / Taller"><input value={f.provider} onChange={e=>set("provider",e.target.value)} style={IS()} placeholder="Nombre del taller externo" /></Field>
        </Grid2>
      </div>
      <div style={{ marginTop:14 }}>
        <Field label="Tiempo estimado de entrega"><input value={f.leadTime} onChange={e=>set("leadTime",e.target.value)} style={IS()} placeholder="3 días, 1 semana…" /></Field>
      </div>
      <div style={{ marginTop:14 }}>
        <Field label="Notas"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{...IS(),resize:"vertical"}} /></Field>
      </div>
      <ModalActions onSave={()=>onSave(f)} onClose={onClose} />
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   QUOTES PAGE — Cotizaciones (admin)
═══════════════════════════════════════════════════ */
const QUOTE_STATUS = {
  pending: { label:"Solicitada", color:"#F59E0B", bg:"#2D2000" },
  quoted:  { label:"Cotizada",   color:"#3B82F6", bg:"#001A2D" },
  sent:    { label:"Enviada",    color:"#10B981", bg:"#002D1A" },
  closed:  { label:"Cerrada",    color:"#8B5CF6", bg:"#1A0A2D" },
};

function QuotesPage({ data, save, toast }) {
  const [modal, setModal] = useState(null);
  const [delId, setDelId] = useState(null);
  const [filter, setFilter] = useState("all");

  const quotes = data.quotes || [];
  const filtered = filter==="all" ? quotes : quotes.filter(q=>q.status===filter);
  const sorted = [...filtered].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));

  const upd = (id, patch) => {
    save({ quotes: quotes.map(q=>q.id===id?{...q,...patch}:q) });
  };

  const del = (id) => { save({ quotes: quotes.filter(q=>q.id!==id) }); toast("Cotización eliminada","err"); setDelId(null); };

  const buildWhatsAppLink = (q) => {
    const client  = data.clients.find(c=>c.id===q.clientId);
    const vehicle = data.vehicles.find(v=>v.id===q.vehicleId);
    const svcLines = (q.services||[]).map(sid => {
      const s = (data.services||SERVICES_CAT).find(x=>x.id===sid);
      return s ? `• ${s.name} — ${fmtCRC(s.price)}` : null;
    }).filter(Boolean).join("\n");

    let msg = `Hola ${client?.name||""}, le compartimos la cotización de Tecno AutoAsisten CR:\n\n`;
    if (vehicle) msg += `Vehículo: ${vehicle.year} ${vehicle.brand} ${vehicle.model} (${vehicle.plate})\n\n`;
    msg += `Servicios cotizados:\n${svcLines || "—"}\n\n`;
    msg += `*Total: ${fmtCRC(q.total)}*\n\n`;
    if (q.notes) msg += `Notas: ${q.notes}\n\n`;
    msg += `Cualquier consulta con gusto le atendemos. ¡Gracias por confiar en nosotros!`;

    const phone = (client?.phone || "").replace(/\D/g,"");
    const waPhone = phone ? (phone.startsWith("506") ? phone : `506${phone}`) : "";
    return `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
  };

  const counts = {
    pending: quotes.filter(q=>q.status==="pending").length,
    quoted:  quotes.filter(q=>q.status==="quoted").length,
    sent:    quotes.filter(q=>q.status==="sent").length,
  };

  return (
    <div>
      <PageHeader title={`Cotizaciones (${quotes.length})`} />

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
        {[["pending","Pendientes de armar",C.amber],["quoted","Listas para enviar",C.blueHi],["sent","Enviadas",C.green]].map(([k,l,color])=>(
          <div key={k} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 18px" }}>
            <div style={{ fontSize:11, color:C.textSm, textTransform:"uppercase", letterSpacing:.7 }}>{l}</div>
            <div style={{ fontSize:24, fontWeight:800, color, marginTop:5 }}>{counts[k]||0}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[["all","Todas"],["pending","Solicitadas"],["quoted","Cotizadas"],["sent","Enviadas"],["closed","Cerradas"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${filter===v?C.blueHi:C.border}`, background:filter===v?`${C.blue}22`:"transparent", color:filter===v?C.blueHi:C.textMd, cursor:"pointer", fontSize:13, fontWeight:filter===v?700:400 }}>{l}</button>
        ))}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {sorted.map(q=>{
          const client  = data.clients.find(c=>c.id===q.clientId);
          const vehicle = data.vehicles.find(v=>v.id===q.vehicleId);
          const sc = QUOTE_STATUS[q.status] || QUOTE_STATUS.pending;
          return (
            <div key={q.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px 20px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ fontWeight:700, fontSize:15 }}>{client?.name || "Cliente desconocido"}</div>
                  {vehicle && <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>🚗 {vehicle.plate} — {vehicle.brand} {vehicle.model}</div>}
                  <div style={{ fontSize:13, color:C.text, marginTop:8, background:C.bg, borderRadius:8, padding:"10px 12px" }}>
                    💬 {q.description}
                  </div>
                  {q.services?.length > 0 && (
                    <div style={{ marginTop:8, fontSize:12, color:C.textSm }}>
                      Servicios: {q.services.map(sid=>(data.services||SERVICES_CAT).find(s=>s.id===sid)?.name).filter(Boolean).join(", ")}
                    </div>
                  )}
                  {q.total > 0 && <div style={{ fontWeight:800, fontSize:17, color:C.green, marginTop:8 }}>{fmtCRC(q.total)}</div>}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end" }}>
                  <Pill label={sc.label} color={sc.color} bg={sc.bg} />
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"flex-end" }}>
                    {q.status === "pending" && <TBtn label="✏️ Armar cotización" color={C.blueHi} onClick={()=>setModal({mode:"edit",item:q})} />}
                    {(q.status === "quoted" || q.status==="sent") && <TBtn label="✏️ Editar" color={C.blueHi} onClick={()=>setModal({mode:"edit",item:q})} />}
                    {q.status === "quoted" && client?.phone && (
                      <a href={buildWhatsAppLink(q)} target="_blank" rel="noopener noreferrer" onClick={()=>upd(q.id,{status:"sent"})}
                        style={{ padding:"6px 12px", borderRadius:7, border:`1px solid ${C.green}44`, background:`${C.green}18`, color:C.green, fontWeight:700, fontSize:12, textDecoration:"none", display:"inline-block" }}>
                        📲 Enviar por WhatsApp
                      </a>
                    )}
                    {q.status === "sent" && client?.phone && (
                      <a href={buildWhatsAppLink(q)} target="_blank" rel="noopener noreferrer"
                        style={{ padding:"6px 12px", borderRadius:7, border:`1px solid ${C.border}`, background:"transparent", color:C.textMd, fontWeight:600, fontSize:12, textDecoration:"none", display:"inline-block" }}>
                        📲 Reenviar
                      </a>
                    )}
                    {q.status !== "closed" && <TBtn label="✓ Cerrar" color={C.purple} onClick={()=>upd(q.id,{status:"closed"})} />}
                    <IBtn icon="🗑" red onClick={()=>setDelId(q.id)} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {sorted.length===0 && <Empty msg="No hay cotizaciones en este filtro" />}
      </div>

      {modal && <QuoteModal item={modal.item} data={data} onSave={(item)=>{ upd(item.id, item); setModal(null); toast("Cotización actualizada"); }} onClose={()=>setModal(null)} />}
      {delId && <Confirm msg="¿Eliminar esta cotización?" onOk={()=>del(delId)} onCancel={()=>setDelId(null)} />}
    </div>
  );
}

function QuoteModal({ item, data, onSave, onClose }) {
  const [f, setF] = useState({ ...item, services: item.services || [] });
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const toggleSvc = (id) => setF(p=>({ ...p, services: p.services.includes(id) ? p.services.filter(s=>s!==id) : [...p.services, id] }));
  const services = data.services || SERVICES_CAT;
  const client = data.clients.find(c=>c.id===f.clientId);
  const total = f.services.reduce((s,id)=>s+(services.find(x=>x.id===id)?.price||0),0);

  return (
    <Modal title="Armar cotización" onClose={onClose} wide>
      <div style={{ background:C.bg, borderRadius:10, padding:"12px 16px", marginBottom:16 }}>
        <div style={{ fontSize:12, color:C.textSm, marginBottom:4 }}>Solicitud del cliente — {client?.name}</div>
        <div style={{ fontSize:14 }}>{f.description}</div>
      </div>

      <Field label="Servicios a incluir">
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:6 }}>
          {services.map(s=>{
            const sel = f.services.includes(s.id);
            return <button key={s.id} onClick={()=>toggleSvc(s.id)} style={{ padding:"7px 13px", borderRadius:8, border:`1px solid ${sel?C.blueHi:C.border}`, background:sel?`${C.blue}22`:"transparent", color:sel?C.blueHi:C.textMd, cursor:"pointer", fontSize:12, fontWeight:sel?700:400 }}>{s.name} · {fmtCRC(s.price)}</button>;
          })}
        </div>
      </Field>

      <div style={{ marginTop:14 }}>
        <Field label="Monto adicional / ajuste manual (₡, opcional)">
          <input type="number" value={f.manualAdjust||0} onChange={e=>set("manualAdjust",+e.target.value)} style={IS()} placeholder="0" />
        </Field>
      </div>

      <div style={{ marginTop:14 }}>
        <Field label="Notas para el cliente"><textarea value={f.notes||""} onChange={e=>set("notes",e.target.value)} rows={2} style={{...IS(),resize:"vertical"}} /></Field>
      </div>

      <div style={{ background:C.bg, borderRadius:10, padding:"12px 16px", marginTop:16, display:"flex", justifyContent:"space-between" }}>
        <span style={{ color:C.textMd, fontSize:14 }}>Total cotizado</span>
        <span style={{ fontWeight:800, fontSize:18, color:C.green }}>{fmtCRC(total + (+f.manualAdjust||0))}</span>
      </div>

      <ModalActions onSave={()=>onSave({ ...f, total: total + (+f.manualAdjust||0), status: "quoted" })} onClose={onClose} />
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   RESET PASSWORD PAGE — desde link de recuperación
═══════════════════════════════════════════════════ */
function ResetPasswordPage({ token, onDone }) {
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [done,     setDone]     = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setLoading(true);
    try {
      const res = await auth.updatePassword(token, password);
      if (res.error) { setError(res.error.message || "Error al actualizar la contraseña."); }
      else { setDone(true); }
    } catch(e) {
      setError("Error de conexión. Intentá de nuevo.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',system-ui,sans-serif", padding:20 }}>
      <div style={{ width:"100%", maxWidth:420 }}>
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:60, height:60, background:`linear-gradient(135deg,${C.blue},${C.cyan})`, borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", fontSize:30, margin:"0 auto 14px" }}>🔑</div>
          <div style={{ fontWeight:800, fontSize:22, color:C.text }}>Crear nueva contraseña</div>
        </div>

        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, padding:"32px 28px" }}>
          {done ? (
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:48, marginBottom:14 }}>✅</div>
              <div style={{ color:C.green, fontWeight:700, fontSize:16, marginBottom:10 }}>¡Contraseña actualizada!</div>
              <div style={{ color:C.textMd, fontSize:14, marginBottom:20 }}>Ya podés iniciar sesión con tu nueva contraseña.</div>
              <button onClick={onDone} style={{ width:"100%", padding:"12px", borderRadius:10, border:"none", background:C.blue, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer" }}>
                Ir a iniciar sesión
              </button>
            </div>
          ) : (
            <>
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:C.textSm, display:"block", marginBottom:5 }}>Nueva contraseña</label>
                  <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" style={{...IS(), padding:"12px 14px"}} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:C.textSm, display:"block", marginBottom:5 }}>Confirmar contraseña</label>
                  <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="Repetí la contraseña" style={{...IS(), padding:"12px 14px"}} />
                </div>
              </div>
              {error && <div style={{ marginTop:14, background:"#2D0000", border:`1px solid ${C.red}44`, borderRadius:8, padding:"10px 14px", fontSize:13, color:C.red }}>❌ {error}</div>}
              <button onClick={handleSubmit} disabled={loading} style={{ marginTop:20, width:"100%", padding:"13px", borderRadius:10, border:"none", background:loading?C.border:`linear-gradient(135deg,${C.blue},${C.cyan})`, color:"#fff", fontWeight:700, fontSize:16, cursor:loading?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                {loading ? <><Spinner />Guardando…</> : "Guardar nueva contraseña →"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
