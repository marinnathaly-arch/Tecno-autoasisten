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


/* Helper: login with stored obfuscated password */
async function loginWithStored(savedEmail, savedPw, setError, setLoading, onLogin) {
  try {
    // Simple XOR deobfuscation
    const pw = atob(savedPw).split("").map((c,i)=>String.fromCharCode(c.charCodeAt(0)^(i%7+3))).join("");
    setLoading(true);
    const res = await auth.signIn(savedEmail, pw);
    if (res.access_token) {
      const userId = res.user?.id;
      const checkRes = await fetch(`${SB_URL}/rest/v1/pending_users?id=eq.${userId}&select=status,name,role`, {
        headers: { apikey: SB_KEY, Authorization: `Bearer ${res.access_token}` }
      });
      const rows = await checkRes.json();
      const row  = rows?.[0];
      if (!row) onLogin(res.access_token, res.user?.email||savedEmail, "admin");
      else if (row.status==="approved") onLogin(res.access_token, row.name||res.user?.email, row.role||"client");
      else setError("Cuenta pendiente de aprobación.");
    } else {
      setError("No se pudo verificar. Ingresá tu contraseña manualmente.");
    }
  } catch(e) {
    setError("Error de conexión.");
  }
  setLoading(false);
}

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
  vehicles:     { table:"vehicles",     toDb: r=>({ id:r.id, client_id:r.clientId, plate:r.plate||"", brand:r.brand||"", model:r.model||"", year:r.year||0, color:r.color||"", vin:r.vin||"", km:r.km||0, fuel:r.fuel||"", notes:r.notes||"", photo_url:r.photoUrl||"" }), fromDb: r=>({ id:r.id, clientId:r.client_id, plate:r.plate||"", brand:r.brand||"", model:r.model||"", year:r.year||0, color:r.color||"", vin:r.vin||"", km:r.km||0, fuel:r.fuel||"", notes:r.notes||"", photoUrl:r.photo_url||"" }) },
  workers:      { table:"workers",      toDb: r=>({ id:r.id, name:r.name, role:r.role||"", phone:r.phone||"", specialty:r.specialty||"", status:r.status||"active" }), fromDb: r=>({ id:r.id, name:r.name, role:r.role||"", phone:r.phone||"", specialty:r.specialty||"", status:r.status||"active" }) },
  appointments: { table:"appointments", toDb: r=>({ id:r.id, client_id:r.clientId, vehicle_id:r.vehicleId, service_id:r.serviceId, date:r.date||"", hour:r.hour||"", status:r.status||"pending", notes:r.notes||"", mechanic:r.mechanic||"", custom_service:r.customService||"" }), fromDb: r=>({ id:r.id, clientId:r.client_id, vehicleId:r.vehicle_id, serviceId:r.service_id, date:r.date||"", hour:r.hour||"", status:r.status||"pending", notes:r.notes||"", mechanic:r.mechanic||"", customService:r.custom_service||"" }) },
  orders:       { table:"orders",       toDb: r=>({ id:r.id, client_id:r.clientId, vehicle_id:r.vehicleId, services:r.services||[], parts:r.parts||[], status:r.status||"active", date:r.date||"", total:r.total||0, notes:r.notes||"", mechanic:r.mechanic||"", mechanic_notes:r.mechanicNotes||"" }), fromDb: r=>({ id:r.id, clientId:r.client_id, vehicleId:r.vehicle_id, services:r.services||[], parts:r.parts||[], status:r.status||"active", date:r.date||"", total:r.total||0, notes:r.notes||"", mechanic:r.mechanic||"", mechanicNotes:r.mechanic_notes||"" }) },
  suppliers:    { table:"suppliers",    toDb: r=>({ id:r.id, name:r.name, contact:r.contact||"", phone:r.phone||"", email:r.email||"", category:r.category||"", pay_terms:r.payTerms||"", notes:r.notes||"", status:r.status||"active" }), fromDb: r=>({ id:r.id, name:r.name, contact:r.contact||"", phone:r.phone||"", email:r.email||"", category:r.category||"", payTerms:r.pay_terms||"", notes:r.notes||"", status:r.status||"active" }) },
  inventory:    { table:"inventory",    toDb: r=>({ id:r.id, name:r.name, category:r.category||"", supplier_id:r.supplierId||null, qty:r.qty||0, min_qty:r.minQty||0, price:r.price||0, cost:r.cost||0, unit:r.unit||"", sku:r.sku||"", notes:r.notes||"" }), fromDb: r=>({ id:r.id, name:r.name, category:r.category||"", supplierId:r.supplier_id||"", qty:r.qty||0, minQty:r.min_qty||0, price:r.price||0, cost:r.cost||0, unit:r.unit||"", sku:r.sku||"", notes:r.notes||"" }) },
  accounting:   { table:"accounting",   toDb: r=>({ id:r.id, type:r.type||"income", category:r.category||"", description:r.description||"", amount:r.amount||0, date:r.date||"", ref:r.ref||"", notes:r.notes||"" }), fromDb: r=>({ id:r.id, type:r.type||"income", category:r.category||"", description:r.description||"", amount:r.amount||0, date:r.date||"", ref:r.ref||"", notes:r.notes||"" }) },
  service_reports: { table:"service_reports", toDb: r=>({ id:r.id, order_id:r.orderId, client_id:r.clientId, vehicle_id:r.vehicleId, mechanic:r.mechanic||"", works_done:r.worksDone||"", observations:r.observations||"", km_at_service:r.kmAtService||0, created_at:r.createdAt||new Date().toISOString() }), fromDb: r=>({ id:r.id, orderId:r.order_id, clientId:r.client_id, vehicleId:r.vehicle_id, mechanic:r.mechanic||"", worksDone:r.works_done||"", observations:r.observations||"", kmAtService:r.km_at_service||0, createdAt:r.created_at||"" }) },
  invoices:        { table:"invoices", toDb: r=>({ id:r.id, client_id:r.clientId, order_id:r.orderId||null, legal_name:r.legalName||"", id_num:r.idNum||"", address:r.address||"", email:r.email||"", phone:r.phone||"", status:r.status||"pending", notes:r.notes||"", created_at:r.createdAt||new Date().toISOString() }), fromDb: r=>({ id:r.id, clientId:r.client_id, orderId:r.order_id||"", legalName:r.legal_name||"", idNum:r.id_num||"", address:r.address||"", email:r.email||"", phone:r.phone||"", status:r.status||"pending", notes:r.notes||"", createdAt:r.created_at||"" }) },
  library:      { table:"library",      toDb: r=>({ id:r.id, title:r.title, brand:r.brand||"", model:r.model||"", year:r.year||0, category:r.category||"", upload_date:r.uploadDate||"", file_size:r.fileSize||"", notes:r.notes||"" }), fromDb: r=>({ id:r.id, title:r.title, brand:r.brand||"", model:r.model||"", year:r.year||0, category:r.category||"", uploadDate:r.upload_date||"", fileSize:r.file_size||"", notes:r.notes||"" }) },
  services:     { table:"services",     toDb: r=>({ id:r.id, name:r.name, price:r.price||0, cat:r.cat||"Otros" }), fromDb: r=>({ id:r.id, name:r.name, price:r.price||0, cat:r.cat||"Otros" }) },
  subcontracts: { table:"subcontracts", toDb: r=>({ id:r.id, name:r.name, price:r.price||0, provider:r.provider||"", lead_time:r.leadTime||"", notes:r.notes||"" }), fromDb: r=>({ id:r.id, name:r.name, price:r.price||0, provider:r.provider||"", leadTime:r.lead_time||"", notes:r.notes||"" }) },
  quotes:       { table:"quotes",       toDb: r=>({ id:r.id, client_id:r.clientId, vehicle_id:r.vehicleId||null, description:r.description||"", status:r.status||"pending", services:r.services||[], total:r.total||0, notes:r.notes||"", created_at:r.createdAt||new Date().toISOString(), quote_type:r.quoteType||"", possible_failure:r.possibleFailure||"", possible_repair:r.possibleRepair||"" }), fromDb: r=>({ id:r.id, clientId:r.client_id, vehicleId:r.vehicle_id||"", description:r.description||"", status:r.status||"pending", services:r.services||[], total:r.total||0, notes:r.notes||"", createdAt:r.created_at||"", quoteType:r.quote_type||"", possibleFailure:r.possible_failure||"", possibleRepair:r.possible_repair||"" }) },
};

async function loadAll() {
  const [clients,vehicles,workers,appointments,orders,suppliers,inventory,accounting,library,services,subcontracts,quotes,reports,invoices] = await Promise.all([
    sb.get("clients"), sb.get("vehicles"), sb.get("workers"), sb.get("appointments"),
    sb.get("orders"), sb.get("suppliers"), sb.get("inventory"), sb.get("accounting"), sb.get("library"),
    sb.get("services"), sb.get("subcontracts"), sb.get("quotes"), sb.get("service_reports"), sb.get("invoices")
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
    reports:      (reports||[]).map(TABLE.service_reports.fromDb),
    invoices:     (invoices||[]).map(TABLE.invoices.fromDb),
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

// Horario del taller: Lun-Vie 4pm-10pm, Sáb 7am-5pm, Dom cerrado
const SCHEDULE = {
  weekday: { start: 16, end: 22 },  // Lun(1)-Vie(5): 16:00 a 22:00
  saturday:{ start: 7,  end: 17 },  // Sáb(6): 7:00 a 17:00
};

function getDayOfWeek(dateStr) {
  // dateStr "YYYY-MM-DD" -> 0=domingo,1=lunes,...6=sábado
  const [y,m,d] = dateStr.split("-").map(Number);
  return new Date(y, m-1, d).getDay();
}

function isWorkingDay(dateStr) {
  if (!dateStr) return false;
  const dow = getDayOfWeek(dateStr);
  return dow !== 0; // cualquier día menos domingo
}

function getHoursForDate(dateStr) {
  if (!dateStr) return [];
  const dow = getDayOfWeek(dateStr);
  if (dow === 0) return []; // domingo cerrado
  const range = dow === 6 ? SCHEDULE.saturday : SCHEDULE.weekday;
  const slots = [];
  for (let h = range.start; h < range.end; h++) {
    slots.push(`${h}:00`);
    if (h < range.end - 1 || range.end % 1 !== 0) slots.push(`${h}:30`);
  }
  // trim last slot if it would equal end time exactly without room
  return slots.filter(s => {
    const [hh,mm] = s.split(":").map(Number);
    return hh < range.end;
  });
}

const SCHEDULE_LABEL = "Lun-Vie 4:00pm-10:00pm · Sáb 7:00am-5:00pm · Dom cerrado";

// Admin has full access — all hours, all days
const ADMIN_HOURS = [
  "0:00","0:30","1:00","1:30","2:00","2:30","3:00","3:30","4:00","4:30",
  "5:00","5:30","6:00","6:30","7:00","7:30","8:00","8:30","9:00","9:30",
  "10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30",
  "15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30",
  "20:00","20:30","21:00","21:30","22:00","22:30","23:00","23:30"
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
const DEFAULT_SETTINGS = {
  currency:"CRC", monthlyGoal:500000,
  schedWeekdayStart:16, schedWeekdayEnd:22,
  schedSatStart:7, schedSatEnd:17, schedSunOpen:false,
  socialCharges:26.67, hiddenNav:[],
};
function getSettings() {
  try { const s=localStorage.getItem("tac_settings"); return s?{...DEFAULT_SETTINGS,...JSON.parse(s)}:DEFAULT_SETTINGS; } catch { return DEFAULT_SETTINGS; }
}
function saveSettings(patch) {
  const next={...getSettings(),...patch};
  localStorage.setItem("tac_settings",JSON.stringify(next));
  return next;
}

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
  { id:"ai_assistant",icon:"🧠", label:"Asistente IA",       group:"ia" },
  { id:"inventory",   icon:"📦", label:"Inventario",         group:"gestión" },
  { id:"suppliers",   icon:"🏭", label:"Proveedores",        group:"gestión" },
  { id:"accounting",  icon:"💰", label:"Contabilidad",       group:"gestión" },
  { id:"library",     icon:"📚", label:"Biblioteca",         group:"gestión" },
  { id:"users",       icon:"🔐", label:"Usuarios",          group:"admin" },
  { id:"subcontracts",icon:"🤝", label:"Subcontrataciones", group:"gestión" },
  { id:"quotes",      icon:"💬", label:"Cotizaciones",      group:"taller" },
  { id:"invoices",    icon:"🧾", label:"Facturas",          group:"taller" },
  { id:"settings",    icon:"⚙️", label:"Configuración",     group:"admin" },
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
        setData({ clients:SEED_CLIENTS, vehicles:SEED_VEHICLES, appointments:SEED_APPTS, orders:SEED_ORDERS, workers:SEED_WORKERS, suppliers:SEED_SUPPLIERS, inventory:SEED_INVENTORY, accounting:SEED_ACCOUNTING, library:SEED_LIBRARY, services:SERVICES_CAT, subcontracts:[], quotes:[], reports:[], invoices:[] });
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
          : page==="ai_assistant" ? <AIAssistantPage data={data} save={save} toast={showToast} />
          : page==="settings"     ? <SettingsPage />
          : page==="users"       ? <UsersPage      session={session} />
          : page==="subcontracts"? <SubcontractsPage data={data} save={save} toast={showToast} />
          : page==="quotes"      ? <QuotesPage      data={data} save={save} toast={showToast} />
          : page==="invoices"    ? <InvoicesPage    data={data} save={save} toast={showToast} />
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
        {groups.map(g => {
          const visibleItems = NAV.filter(n=>n.group===g && !getSettings().hiddenNav?.includes(n.id));
          if (visibleItems.length===0) return null;
          return (
          <div key={g} style={{ marginBottom:4 }}>
            {open && <div style={{ fontSize:10, fontWeight:700, color:C.textSm, textTransform:"uppercase", letterSpacing:1, padding:"10px 8px 4px" }}>{GROUPS[g]}</div>}
            {NAV.filter(n=>n.group===g && !getSettings().hiddenNav?.includes(n.id)).map(n => {
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
        ); })}
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
  const { clients, appointments, orders, vehicles, workers, inventory } = data;
  const cfg = getSettings();
  const fmt = (n) => cfg.currency==="USD" ? `$${(n/530).toFixed(2)}` : fmtCRC(n);

  const todayStr = today();
  const thisMonth = new Date().toISOString().slice(0,7);

  const todayAppts   = appointments.filter(a=>a.date===todayStr);
  const pendingAppts = appointments.filter(a=>a.status==="pending");
  const activeOrders = orders.filter(o=>o.status==="active");
  const monthIncome  = orders.filter(o=>o.status==="completed"&&o.date?.startsWith(thisMonth)).reduce((s,o)=>s+o.total,0);
  const lowStock     = (inventory||[]).filter(i=>i.qty<=i.minQty);
  const goalPct      = cfg.monthlyGoal>0 ? Math.min(100,Math.round(monthIncome/cfg.monthlyGoal*100)) : 0;

  // Health check
  const alerts = [];
  if (pendingAppts.length>0) alerts.push(`${pendingAppts.length} cita${pendingAppts.length>1?"s":""} sin confirmar`);
  if (activeOrders.length>0) alerts.push(`${activeOrders.length} orden${activeOrders.length>1?"es":""} activa${activeOrders.length>1?"s":""}`);
  if (lowStock.length>0)     alerts.push(`${lowStock.length} producto${lowStock.length>1?"s":""} con stock bajo`);
  const isOk = alerts.length===0;

  const upcoming = [...appointments].filter(a=>a.date>=todayStr&&a.status!=="cancelled").sort((a,b)=>a.date.localeCompare(b.date)||a.hour.localeCompare(b.hour)).slice(0,4);

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:22, fontWeight:800 }}>Buenos días, Tecno AutoAsisten CR 👋</div>
        <div style={{ color:C.textMd, fontSize:14, marginTop:4 }}>{todayLabel()}</div>
      </div>

      {/* Health Banner */}
      <div style={{ background:isOk?`${C.green}18`:`${C.amber}18`, border:`1px solid ${isOk?C.green:C.amber}44`, borderRadius:12, padding:"14px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ fontSize:28 }}>{isOk?"✅":"⚠️"}</div>
        <div>
          <div style={{ fontWeight:700, color:isOk?C.green:C.amber, fontSize:15 }}>
            {isOk ? "Taller al día — sin alertas pendientes" : `${alerts.length} alerta${alerts.length>1?"s":""} activa${alerts.length>1?"s":""}`}
          </div>
          {!isOk && <div style={{ fontSize:13, color:C.textMd, marginTop:3 }}>{alerts.join(" · ")}</div>}
        </div>
        {!isOk && <button onClick={()=>setPage(pendingAppts.length>0?"appointments":"orders")} style={{ marginLeft:"auto", padding:"7px 14px", borderRadius:8, border:`1px solid ${C.amber}`, background:"transparent", color:C.amber, cursor:"pointer", fontSize:12, fontWeight:600, whiteSpace:"nowrap" }}>Ver →</button>}
      </div>

      {/* KPI Cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:14, marginBottom:24 }}>
        {[
          { label:"Citas hoy",        value:todayAppts.length,  sub:`${pendingAppts.length} sin confirmar`, color:C.blueHi, icon:"📅", page:"appointments" },
          { label:"Órdenes activas",  value:activeOrders.length,sub:"En proceso",                          color:C.amber,  icon:"🔧", page:"orders" },
          { label:"Ingresos del mes", value:fmt(monthIncome),   sub:`Meta: ${fmt(cfg.monthlyGoal)}`,       color:C.green,  icon:"💰", page:"metrics" },
          { label:"Clientes",         value:clients.length,     sub:`${vehicles.length} vehículos`,        color:C.purple, icon:"👤", page:"clients" },
        ].map(k=>(
          <div key={k.label} onClick={()=>setPage(k.page)} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"18px 20px", cursor:"pointer", transition:"border-color .15s" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:11, color:C.textSm, fontWeight:600, textTransform:"uppercase", letterSpacing:.8 }}>{k.label}</div>
                <div style={{ fontSize:26, fontWeight:800, color:k.color, marginTop:6, lineHeight:1 }}>{k.value}</div>
                <div style={{ fontSize:11, color:C.textSm, marginTop:4 }}>{k.sub}</div>
              </div>
              <span style={{ fontSize:22 }}>{k.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly goal progress */}
      {cfg.monthlyGoal>0 && (
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"18px 20px", marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
            <div style={{ fontWeight:700 }}>Meta mensual</div>
            <div style={{ fontWeight:700, color:goalPct>=100?C.green:C.blueHi }}>{goalPct}%</div>
          </div>
          <div style={{ height:10, background:C.border, borderRadius:5, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${goalPct}%`, background:goalPct>=100?C.green:`linear-gradient(90deg,${C.blue},${C.cyan})`, borderRadius:5, transition:"width .5s" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6, fontSize:12, color:C.textSm }}>
            <span>{fmt(monthIncome)} ingresado</span>
            <span>Meta: {fmt(cfg.monthlyGoal)}</span>
          </div>
        </div>
      )}

      {/* Low stock alert */}
      {lowStock.length>0 && (
        <div onClick={()=>setPage("inventory")} style={{ background:"#2D1000", border:`1px solid ${C.red}44`, borderRadius:10, padding:"12px 16px", marginBottom:20, fontSize:13, color:C.red, cursor:"pointer", display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:18 }}>📦</span>
          <span>⚠️ Stock bajo: {lowStock.map(i=>i.name).join(", ")}</span>
          <span style={{ marginLeft:"auto", fontSize:12 }}>Ver →</span>
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        {/* Upcoming appointments */}
        <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px 22px" }}>
          <div style={{ fontWeight:700, marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span>Próximas citas</span>
            <button onClick={()=>setPage("appointments")} style={{ fontSize:12, color:C.blueHi, background:"none", border:"none", cursor:"pointer" }}>Ver todas →</button>
          </div>
          {upcoming.length===0 && <Empty msg="No hay citas próximas" />}
          {upcoming.map(a=>{
            const client  = data.clients.find(c=>c.id===a.clientId);
            const vehicle = data.vehicles.find(v=>v.id===a.vehicleId);
            const svc     = a.serviceId==="__custom__"?(a.customService||"Servicio"):(data.services||SERVICES_CAT).find(s=>s.id===a.serviceId)?.name||a.serviceId;
            const sc      = STATUS_COLORS[a.status];
            return (
              <div key={a.id} style={{ display:"flex", gap:12, alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${C.border}` }}>
                <div style={{ background:C.bg, borderRadius:8, padding:"6px 10px", textAlign:"center", minWidth:52, flexShrink:0 }}>
                  <div style={{ fontSize:10, color:C.textSm }}>{a.date.slice(5).replace("-","/")}</div>
                  <div style={{ fontWeight:700, color:C.blueHi, fontSize:13 }}>{a.hour}</div>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:13, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{client?.name||"—"}</div>
                  <div style={{ fontSize:11, color:C.textSm }}>{vehicle?.plate} · {svc}</div>
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
            const client  = data.clients.find(c=>c.id===o.clientId);
            const vehicle = data.vehicles.find(v=>v.id===o.vehicleId);
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
            <div key={v.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
              {/* Vehicle photo */}
              {v.photoUrl && (
                <div style={{ height:140, overflow:"hidden", position:"relative" }}>
                  <img src={v.photoUrl} alt={v.plate} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(transparent,rgba(0,0,0,.7))", padding:"20px 16px 8px", display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
                    <span style={{ fontWeight:800, fontSize:16, color:"#fff" }}>{v.plate}</span>
                    <span style={{ fontSize:11, background:"rgba(255,255,255,.2)", color:"#fff", borderRadius:4, padding:"2px 8px" }}>{v.fuel}</span>
                  </div>
                </div>
              )}
              <div style={{ padding:"16px 18px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    {!v.photoUrl && <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <span style={{ fontWeight:700, fontSize:16 }}>{v.plate}</span>
                      <span style={{ background:C.border, borderRadius:4, padding:"2px 8px", fontSize:11, color:C.textMd }}>{v.fuel}</span>
                    </div>}
                    <div style={{ fontWeight:600, fontSize:14, marginTop:v.photoUrl?0:3 }}>{v.year} {v.brand} {v.model}</div>
                    <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>👤 {client?.name||"Sin cliente"} · {v.color}</div>
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <IBtn icon="✏️" onClick={()=>setModal({mode:"edit",item:v})} />
                    <IBtn icon="🗑" red onClick={()=>setDelId(v.id)} />
                  </div>
                </div>
                <div style={{ display:"flex", gap:12, marginTop:12 }}>
                  <Stat label="Kilometraje" value={`${Number(v.km||0).toLocaleString()} km`} />
                  {v.vin && <Stat label="VIN" value={v.vin.slice(-6)} />}
                </div>
                {v.notes && <div style={{ marginTop:10, fontSize:12, color:C.textSm, borderTop:`1px solid ${C.border}`, paddingTop:10 }}>💬 {v.notes}</div>}
              </div>
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
  const [uploading, setUploading] = useState(false);
  const set = (k,v) => setF(p=>({...p,[k]:v}));
  const FUELS = ["Gasolina","Diésel","Híbrido","Eléctrico"];
  const fileRef = useRef(null);

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      set("photoUrl", ev.target.result);
      setUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <Modal title={item.id?"Editar vehículo":"Registrar vehículo"} onClose={onClose} wide>
      {/* Photo upload */}
      <div style={{ marginBottom:16 }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display:"none" }} />
        <div onClick={()=>fileRef.current?.click()} style={{ cursor:"pointer", borderRadius:12, overflow:"hidden", border:`2px dashed ${f.photoUrl?C.green:C.border}`, height:140, display:"flex", alignItems:"center", justifyContent:"center", background:C.bg, position:"relative" }}>
          {f.photoUrl
            ? <img src={f.photoUrl} alt="Vehículo" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
            : <div style={{ textAlign:"center", color:C.textSm }}>
                <div style={{ fontSize:32, marginBottom:6 }}>📷</div>
                <div style={{ fontSize:13 }}>{uploading?"Cargando…":"Tocar para agregar foto del vehículo"}</div>
              </div>
          }
          {f.photoUrl && <div style={{ position:"absolute", bottom:8, right:8, background:"rgba(0,0,0,.6)", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#fff" }}>Tocar para cambiar</div>}
        </div>
        {f.photoUrl && <button onClick={()=>set("photoUrl","")} style={{ marginTop:6, fontSize:12, color:C.red, background:"none", border:"none", cursor:"pointer" }}>✕ Quitar foto</button>}
      </div>

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
          const svc     = (data.services||SERVICES_CAT).find(s=>s.id===a.serviceId); const svcName = a.serviceId==="__custom__" ? (a.customService||"Servicio personalizado") : svc?.name||a.serviceId;
          const sc      = STATUS_COLORS[a.status];

          const waLink = (() => {
            const phone = (client?.phone||"").replace(/\D/g,"");
            if (!phone) return null;
            const waPhone = phone.startsWith("506") ? phone : `506${phone}`;
            const statusMsg = a.status==="confirmed" ? "✅ *Su cita ha sido CONFIRMADA.*" : a.status==="cancelled" ? "❌ *Su cita ha sido CANCELADA.*" : "📅 *Recordatorio de cita.*";
            const msg = `Hola ${client?.name||""}, le escribe Tecno AutoAsisten CR.\n\n${statusMsg}\n\n📅 Fecha: ${fmtDate(a.date)}\n🕐 Hora: ${a.hour}\n🚗 Vehículo: ${vehicle?.plate||""} ${vehicle?.brand||""} ${vehicle?.model||""}\n🔧 Servicio: ${svcName}\n👷 Mecánico: ${a.mechanic||""}\n\n${a.notes?`Notas: ${a.notes}\n\n`:""}Cualquier consulta estamos a su disposición. ¡Gracias!`;
            return `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
          })();

          return (
            <div key={a.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px", display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
              <div style={{ background:C.bg, borderRadius:8, padding:"7px 12px", textAlign:"center", minWidth:58, flexShrink:0 }}>
                <div style={{ fontSize:10, color:C.textSm }}>{fmtDate(a.date)}</div>
                <div style={{ fontWeight:700, color:C.blueHi, fontSize:15 }}>{a.hour}</div>
              </div>
              <div style={{ flex:1, minWidth:160 }}>
                <div style={{ fontWeight:700, fontSize:14 }}>{client?.name||"—"} <span style={{ color:C.textSm, fontWeight:400, fontSize:12 }}>· {vehicle?.plate}</span></div>
                <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>{svcName} · {a.mechanic}</div>
                {a.notes?.includes("[Solicitud electrónica]") && <span style={{ fontSize:10, fontWeight:700, background:`${C.cyan}22`, color:C.cyan, borderRadius:4, padding:"2px 7px", display:"inline-block", marginTop:3 }}>🖥️ Solicitud electrónica</span>}
                {a.notes && !a.notes.includes("[Solicitud electrónica]") && <div style={{ fontSize:11, color:C.textSm }}>💬 {a.notes}</div>}
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                <Pill label={sc?.label} color={sc?.color} bg={sc?.bg} />
                {a.status==="pending"   && <TBtn label="Confirmar" color={C.green}  onClick={()=>upd(a.id,{status:"confirmed"})} />}
                {a.status==="confirmed" && <TBtn label="Completar" color={C.purple} onClick={()=>upd(a.id,{status:"done"})} />}
                {a.status!=="cancelled"&&a.status!=="done" && <TBtn label="Cancelar" color={C.red} onClick={()=>upd(a.id,{status:"cancelled"})} />}
                {waLink && (
                  <a href={waLink} target="_blank" rel="noopener noreferrer"
                    style={{ padding:"6px 10px", borderRadius:7, border:`1px solid #25D36644`, background:`#25D36618`, color:"#25D366", fontWeight:700, fontSize:12, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:4 }}>
                    📲 WA
                  </a>
                )}
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
            <option value="__custom__">✏️ Escribir manualmente…</option>
          </select>
        </Field>
        {f.serviceId==="__custom__" && (
          <Field label="Describí el servicio">
            <input value={f.customService||""} onChange={e=>set("customService",e.target.value)} placeholder="Ej: Cambio de correa de distribución…" style={IS()} />
          </Field>
        )}
        <Field label="Mecánico">
          <select value={f.mechanic} onChange={e=>set("mechanic",e.target.value)} style={IS()}>
            {data.workers.filter(w=>w.status==="active").map(w=><option key={w.id} value={w.name}>{w.name}</option>)}
          </select>
        </Field>
        <Field label="Fecha"><input type="date" value={f.date} onChange={e=>set("date",e.target.value)} style={IS()} /></Field>
        <Field label="Hora">
          <select value={f.hour} onChange={e=>set("hour",e.target.value)} style={IS()}>
            {ADMIN_HOURS.map(h=><option key={h} value={h}>{h}</option>)}
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
  const [reportModal, setReportModal] = useState(null);

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

  const saveReport = async (report) => {
    const list = [...(data.reports||[])];
    const existing = list.findIndex(r=>r.orderId===report.orderId);
    if (existing>=0) list[existing]=report;
    else list.push(report);
    save({ reports:list });
    toast("Informe guardado ✓");
    setReportModal(null);
  };

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

          const waReadyLink = (() => {
            const phone = (client?.phone||"").replace(/\D/g,"");
            if (!phone || o.status !== "completed") return null;
            const waPhone = phone.startsWith("506") ? phone : `506${phone}`;
            const msg = `Hola ${client?.name||""}! 🎉\n\nLe informamos que su vehículo *${vehicle?.plate||""} ${vehicle?.brand||""} ${vehicle?.model||""}* ya está *LISTO* para retirar en Tecno AutoAsisten CR.\n\n✅ Servicios realizados:\n${o.services.map(sid=>(data.services||SERVICES_CAT).find(s=>s.id===sid)?.name).filter(Boolean).map(n=>`• ${n}`).join("\n")}\n\n💰 Total: ${fmtCRC(o.total)}\n\n¡Gracias por confiar en nosotros! Cualquier consulta estamos a su disposición.`;
            return `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
          })();

          return (
            <div key={o.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"14px 18px" }}>
              <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ fontWeight:700, fontSize:15 }}>{client?.name||"—"} <span style={{ fontWeight:400, color:C.textSm, fontSize:13 }}>· {vehicle?.plate}</span></div>
                  <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>{o.mechanic} · {fmtDate(o.date)}</div>
                  <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>{o.services.map(sid=>(data.services||SERVICES_CAT).find(s=>s.id===sid)?.name).join(", ")}</div>
                  {o.mechanicNotes && <div style={{ fontSize:12, color:C.blueHi, marginTop:4 }}>🔧 {o.mechanicNotes}</div>}
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontWeight:800, fontSize:18, color:C.green }}>{fmtCRC(o.total)}</div>
                  <Pill label={sc?.label} color={sc?.color} bg={sc?.bg} />
                </div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  <TBtn label="Ver" color={C.blueHi} onClick={()=>setDetail(o)} />
                  {o.status==="active" && <TBtn label="Completar" color={C.green} onClick={()=>upd(o.id,{status:"completed"})} />}
                  {o.status==="completed" && (
                    <TBtn label={`📋 ${(data.reports||[]).find(r=>r.orderId===o.id) ? "Ver informe" : "Llenar informe"}`} color={C.purple} onClick={()=>setReportModal(o)} />
                  )}
                  {waReadyLink && (
                    <a href={waReadyLink} target="_blank" rel="noopener noreferrer"
                      style={{ padding:"6px 10px", borderRadius:7, border:`1px solid #25D36644`, background:`#25D36618`, color:"#25D366", fontWeight:700, fontSize:12, textDecoration:"none", display:"inline-flex", alignItems:"center", gap:4, whiteSpace:"nowrap" }}>
                      📲 Avisar listo
                    </a>
                  )}
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
      {reportModal && <ServiceReportModal order={reportModal} data={data} existing={(data.reports||[]).find(r=>r.orderId===reportModal.id)} onSave={saveReport} onClose={()=>setReportModal(null)} />}
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

      <Field label="Notas del cliente"><textarea value={f.notes} onChange={e=>set("notes",e.target.value)} rows={2} style={{...IS(),resize:"vertical"}} /></Field>
      <div style={{ marginTop:12 }}>
        <Field label="🔧 Notas del mecánico (proceso / diagnóstico)"><textarea value={f.mechanicNotes||""} onChange={e=>set("mechanicNotes",e.target.value)} rows={2} placeholder="Ej: Se encontró desgaste en pastillas, se reemplazaron…" style={{...IS(),resize:"vertical"}} /></Field>
      </div>

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

/* =======================================================
   UNIFIED AI ASSISTANT
======================================================= */
async function callClaude(systemPrompt, messages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1500, system:systemPrompt, messages })
  });
  const d = await res.json();
  return d.content?.map(b=>b.text||"").join("") || "Sin respuesta.";
}

function Spinner() {
  return <span style={{ display:"inline-block", width:14, height:14, border:"2px solid #ffffff44", borderTop:"2px solid #fff", borderRadius:"50%", animation:"spin .7s linear infinite" }}>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </span>;
}

function PasswordField({ value, onChange, onKeyDown, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position:"relative" }}>
      <input
        type={show?"text":"password"}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{...IS(), padding:"12px 44px 12px 14px"}}
      />
      <button
        type="button"
        onClick={()=>setShow(s=>!s)}
        style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:C.textSm, fontSize:16, padding:4 }}
        tabIndex={-1}
      >
        {show ? "🙈" : "👁️"}
      </button>
    </div>
  );
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
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem("tac_remember_email"));
  const [biometricAvail, setBiometricAvail] = useState(false);

  useEffect(()=>{
    // Pre-fill remembered email
    const saved = localStorage.getItem("tac_remember_email");
    if (saved) setEmail(saved);
    // Check if biometric auth is available
    if (window.PublicKeyCredential) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(avail => setBiometricAvail(avail))
        .catch(()=>{});
    }
  },[]);

  const handleBiometric = async () => {
    setError("");
    const savedEmail = localStorage.getItem("tac_remember_email");
    const savedPw    = localStorage.getItem("tac_pw_enc");

    if (!savedEmail || !savedPw) {
      setError("Iniciá sesión con tu correo y contraseña una primera vez y activá 'Recordar mi correo'. Luego podrás usar Face ID.");
      return;
    }

    try {
      // Check if we have a registered credential
      const credId = localStorage.getItem("tac_cred_id");

      if (!credId) {
        // REGISTER: create a new credential tied to this device
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        const userId = new Uint8Array(16);
        window.crypto.getRandomValues(userId);

        const cred = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp:   { name:"Tecno AutoAsisten CR", id: window.location.hostname },
            user: { id: userId, name: savedEmail, displayName: savedEmail },
            pubKeyCredParams: [{ type:"public-key", alg:-7 }, { type:"public-key", alg:-257 }],
            authenticatorSelection: { userVerification:"required", authenticatorAttachment:"platform" },
            timeout: 60000,
          }
        });
        localStorage.setItem("tac_cred_id", btoa(String.fromCharCode(...new Uint8Array(cred.rawId))));
        // Now log in with stored credentials
        await loginWithStored(savedEmail, savedPw, setError, setLoading, onLogin);
        return;
      }

      // AUTHENTICATE: verify with existing credential
      const challenge2 = new Uint8Array(32);
      window.crypto.getRandomValues(challenge2);
      const rawId = Uint8Array.from(atob(credId), c=>c.charCodeAt(0));
      await navigator.credentials.get({
        publicKey: {
          challenge: challenge2,
          allowCredentials: [{ type:"public-key", id: rawId }],
          userVerification: "required",
          timeout: 60000,
        }
      });
      // Biometric passed — log in with stored credentials
      await loginWithStored(savedEmail, savedPw, setError, setLoading, onLogin);

    } catch(e) {
      if (e.name === "NotAllowedError") setError("Face ID cancelado.");
      else if (e.name === "InvalidStateError") setError("Ya hay una credencial registrada. Intentá de nuevo.");
      else setError("Face ID no disponible en este dispositivo.");
    }
  };

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

        // 2. Try to sign in immediately to get a token (works when email confirm is off)
        // If email confirm is ON, Supabase won't let us log in yet — we store the pending record anyway
        const signInRes = await auth.signIn(email.trim(), password);
        const userId = res.user?.id || res.id || signInRes.user?.id;
        const token  = signInRes.access_token;

        // 3. Save profile in pending_users table
        if (userId) {
          await fetch(`${SB_URL}/rest/v1/pending_users`, {
            method: "POST",
            headers: { apikey: SB_KEY, Authorization: `Bearer ${token||SB_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ id: userId, name: name.trim(), phone: phone.trim(), email: email.trim(), status: "pending", role: "client", created_at: new Date().toISOString() })
          });
        }
        setPending(true);

      } else {
        // LOGIN — try sign in
        const res = await auth.signIn(email.trim(), password);

        // Handle "Email not confirmed" error specifically
        if (res.error?.message?.toLowerCase().includes("email not confirmed")) {
          // Try to check pending_users by email instead
          const checkByEmail = await fetch(`${SB_URL}/rest/v1/pending_users?email=eq.${encodeURIComponent(email.trim())}&select=status,name,role`, {
            headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
          });
          const rows = await checkByEmail.json();
          const row  = rows?.[0];
          if (row?.status === "pending") {
            setError("Tu cuenta está pendiente de aprobación. El administrador te confirmará pronto.");
          } else if (row?.status === "approved") {
            setError("Tu cuenta fue aprobada pero necesita confirmación de correo. Revisá tu bandeja de entrada.");
          } else {
            setError("Correo o contraseña incorrectos.");
          }
          setLoading(false); return;
        }

        if (res.error || !res.access_token) {
          setError(res.error?.message || "Correo o contraseña incorrectos.");
          setLoading(false); return;
        }

        // Check approval status
        const userId = res.user?.id;
        const checkRes = await fetch(`${SB_URL}/rest/v1/pending_users?id=eq.${userId}&select=status,name,role`, {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${res.access_token}` }
        });
        const userRows = await checkRes.json();
        const userRow  = userRows?.[0];

        if (!userRow) {
          if (rememberMe) {
            localStorage.setItem("tac_remember_email", email.trim());
            const enc = btoa(password.split("").map((c,i)=>String.fromCharCode(c.charCodeAt(0)^(i%7+3))).join(""));
            localStorage.setItem("tac_pw_enc", enc);
          } else { localStorage.removeItem("tac_remember_email"); localStorage.removeItem("tac_pw_enc"); }
          onLogin(res.access_token, res.user?.email || email.trim(), "admin");
        } else if (userRow.status === "approved") {
          if (rememberMe) {
            localStorage.setItem("tac_remember_email", email.trim());
            const enc = btoa(password.split("").map((c,i)=>String.fromCharCode(c.charCodeAt(0)^(i%7+3))).join(""));
            localStorage.setItem("tac_pw_enc", enc);
          } else { localStorage.removeItem("tac_remember_email"); localStorage.removeItem("tac_pw_enc"); }
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
              <PasswordField value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="Mínimo 6 caracteres" />
            </div>
            {mode==="register" && (
              <div>
                <label style={{ fontSize:12, fontWeight:600, color:C.textSm, display:"block", marginBottom:5 }}>Confirmar contraseña *</label>
                <PasswordField value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="Repetí la contraseña" />
              </div>
            )}
          </div>

          {mode==="login" && (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
              <input type="checkbox" id="remember" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)} style={{ width:16, height:16, cursor:"pointer", accentColor:C.blueHi }} />
              <label htmlFor="remember" style={{ fontSize:13, color:C.textMd, cursor:"pointer" }}>Recordar mi correo</label>
            </div>
          )}

          {error && <div style={{ marginTop:14, background:"#2D0000", border:`1px solid ${C.red}44`, borderRadius:8, padding:"10px 14px", fontSize:13, color:C.red }}>❌ {error}</div>}

          {mode==="register" && (
            <div style={{ marginTop:14, background:`${C.amber}11`, border:`1px solid ${C.amber}33`, borderRadius:8, padding:"10px 14px", fontSize:12, color:C.amber }}>
              ⚠️ Tu cuenta será revisada por el administrador antes de activarse.
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading} style={{ marginTop:16, width:"100%", padding:"13px", borderRadius:10, border:"none", background:loading?C.border:`linear-gradient(135deg,${C.blue},${C.cyan})`, color:"#fff", fontWeight:700, fontSize:16, cursor:loading?"default":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
            {loading ? <><Spinner />{mode==="login"?"Entrando…":"Enviando solicitud…"}</> : mode==="login" ? "Entrar al sistema →" : "Enviar solicitud →"}
          </button>

          {mode==="login" && biometricAvail && (
            <button onClick={handleBiometric} style={{ marginTop:10, width:"100%", padding:"11px", borderRadius:10, border:`1px solid ${C.border}`, background:"transparent", color:C.textMd, fontWeight:600, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              🔐 {localStorage.getItem("tac_cred_id") ? "Entrar con Face ID / Huella" : "Activar Face ID / Huella"}
            </button>
          )}

          {mode==="login" && (
            <button onClick={()=>{ setMode("forgot"); setError(""); }} style={{ marginTop:10, width:"100%", padding:"6px", background:"none", border:"none", color:C.blueHi, fontSize:13, cursor:"pointer", textAlign:"center" }}>
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
  const CP = {
    bg:      "#F0F4FF",
    card:    "#FFFFFF",
    border:  "#E2E8F0",
    text:    "#1E293B",
    textMd:  "#475569",
    textSm:  "#94A3B8",
    blue:    "#2563EB",
    blueHi:  "#3B82F6",
    cyan:    "#0EA5E9",
    green:   "#10B981",
    amber:   "#F59E0B",
    red:     "#EF4444",
    purple:  "#8B5CF6",
    navBg:   "#1E293B",
  };

  const [tab, setTab] = useState("home");
  const [loading, setLoading] = useState(true);

  // Data
  const [myClient, setMyClient] = useState(null);
  const [invForm, setInvForm] = useState({ legalName:"", idNum:"", address:"", email:session.email||"", phone:"", orderId:"", notes:"" });
  const [invDone, setInvDone] = useState(false);
  const [invLoad, setInvLoad] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [appts,    setAppts]    = useState([]);
  const [orders,   setOrders]   = useState([]);
  const [myQuotes, setMyQuotes] = useState([]);
  const [myReports,setMyReports]= useState([]);
  const [myInvoices,setMyInvoices]=useState([]);
  const [workers,  setWorkers]  = useState([]);
  const [services, setServices] = useState(SERVICES_CAT);

  // Registration
  const [regStep,    setRegStep]    = useState("client");
  const [regForm,    setRegForm]    = useState({ name:"", phone:"", idNum:"", plate:"", brand:"", model:"", year:new Date().getFullYear(), color:"", fuel:"Gasolina", km:0 });
  const [regLoading, setRegLoading] = useState(false);
  const [regError,   setRegError]   = useState("");

  // Book appt
  const [apptForm,    setApptForm]    = useState({ vehicleId:"", serviceId:"diag", customService:"", date:today(), hour:getHoursForDate(today())[0]||"", notes:"" });
  const [apptDone,    setApptDone]    = useState(false);
  const [apptLoading, setApptLoading] = useState(false);

  // Quote
  const [quoteType,    setQuoteType]    = useState("");
  const [quoteFailure, setQuoteFailure] = useState("");
  const [quoteVehicle, setQuoteVehicle] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteDone,    setQuoteDone]    = useState(false);

  // Selected vehicle for home view
  const [selectedVeh, setSelectedVeh] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [cls,vhs,ords,apts,wks,svcs,qts,rpts,invs] = await Promise.all([
          sb.get("clients"),sb.get("vehicles"),sb.get("orders"),sb.get("appointments"),
          sb.get("workers"),sb.get("services"),sb.get("quotes"),sb.get("service_reports"),sb.get("invoices")
        ]);
        const allClients  = (cls||[]).map(TABLE.clients.fromDb);
        const allVehicles = (vhs||[]).map(TABLE.vehicles.fromDb);
        const allOrders   = (ords||[]).map(TABLE.orders.fromDb);
        const allAppts    = (apts||[]).map(TABLE.appointments.fromDb);
        const allWorkers  = (wks||[]).map(TABLE.workers.fromDb);
        const allSvcs     = (svcs||[]).map(TABLE.services.fromDb);
        const allQuotes   = (qts||[]).map(TABLE.quotes.fromDb);
        const allReports  = (rpts||[]).map(TABLE.service_reports.fromDb);
        const allInvs     = (invs||[]).map(TABLE.invoices.fromDb);
        if (allSvcs.length) setServices(allSvcs);
        const me = allClients.find(c=>c.email?.toLowerCase()===session.email?.toLowerCase()||c.name?.toLowerCase()===session.email?.toLowerCase());
        setMyClient(me||null);
        const myVehs = me ? allVehicles.filter(v=>v.clientId===me.id) : [];
        setVehicles(myVehs);
        setOrders(me ? allOrders.filter(o=>o.clientId===me.id) : []);
        setAppts(me  ? allAppts.filter(a=>a.clientId===me.id)  : []);
        setMyQuotes(me ? allQuotes.filter(q=>q.clientId===me.id) : []);
        setMyReports(me ? allReports.filter(r=>r.clientId===me.id) : []);
        setMyInvoices(me ? allInvs.filter(i=>i.clientId===me.id) : []);
        setWorkers(allWorkers.filter(w=>w.status==="active"));
        if (myVehs.length) {
          setApptForm(f=>({...f, vehicleId:myVehs[0].id}));
          setQuoteVehicle(myVehs[0].id);
        }
      } catch(e) { console.error(e); }
      setLoading(false);
    })();
  }, []);

  const submitRegistration = async () => {
    setRegError(""); setRegLoading(true);
    try {
      if (regStep==="client") {
        if (!regForm.name.trim()||!regForm.phone.trim()) { setRegError("Nombre y teléfono son obligatorios."); setRegLoading(false); return; }
        const nc = { id:uid(), name:regForm.name.trim(), phone:regForm.phone.trim(), email:session.email, idNum:regForm.idNum.trim(), notes:"" };
        await sb.upsert("clients", TABLE.clients.toDb(nc));
        setMyClient(nc); setRegStep("vehicle");
      } else {
        if (!regForm.plate.trim()||!regForm.brand.trim()) { setRegError("Placa y marca son obligatorias."); setRegLoading(false); return; }
        const nv = { id:uid(), clientId:myClient.id, plate:regForm.plate.trim().toUpperCase(), brand:regForm.brand.trim(), model:regForm.model.trim(), year:regForm.year, color:regForm.color.trim(), fuel:regForm.fuel, km:regForm.km, vin:"", notes:"", photoUrl:"" };
        await sb.upsert("vehicles", TABLE.vehicles.toDb(nv));
        setVehicles([nv]); setApptForm(f=>({...f,vehicleId:nv.id})); setQuoteVehicle(nv.id);
        setRegStep("done");
      }
    } catch(e) { setRegError("Error al guardar."); }
    setRegLoading(false);
  };

  const bookAppointment = async () => {
    if (!myClient||!apptForm.vehicleId||!apptForm.date) return;
    setApptLoading(true);
    const na = { id:uid(), clientId:myClient.id, vehicleId:apptForm.vehicleId, serviceId:apptForm.serviceId, customService:apptForm.serviceId==="__custom__"?(apptForm.customService||""):"", date:apptForm.date, hour:apptForm.hour, status:"pending", notes:`[Solicitud electrónica] ${apptForm.notes||""}`.trim(), mechanic:workers[0]?.name||"" };
    await sb.upsert("appointments", TABLE.appointments.toDb(na));
    setAppts(prev=>[...prev,na]); setApptDone(true); setApptLoading(false);
    setTimeout(()=>setApptDone(false),4000);
  };

  const submitQuote = async () => {
    if (!myClient||!quoteType||!quoteFailure.trim()) return;
    setQuoteLoading(true);
    const nq = { id:uid(), clientId:myClient.id, vehicleId:quoteVehicle||null, quoteType, possibleFailure:quoteFailure.trim(), possibleRepair:"", description:"", status:"pending", services:[], total:0, notes:"", createdAt:new Date().toISOString() };
    await sb.upsert("quotes", TABLE.quotes.toDb(nq));
    setMyQuotes(prev=>[...prev,nq]); setQuoteType(""); setQuoteFailure(""); setQuoteDone(true); setQuoteLoading(false);
    setTimeout(()=>setQuoteDone(false),4000);
  };

  if (loading) return (
    <div style={{ minHeight:"100vh", background:CP.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Inter',system-ui,sans-serif" }}>
      <div style={{ textAlign:"center", color:CP.textMd }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🔧</div>
        <div>Cargando tu portal…</div>
      </div>
    </div>
  );

  const ISC = () => ({ background:"#F8FAFC", border:`1px solid ${CP.border}`, borderRadius:10, color:CP.text, padding:"11px 14px", fontSize:14, width:"100%", outline:"none" });

  const upcomingAppts = appts.filter(a=>a.date>=today()&&a.status!=="cancelled").sort((a,b)=>a.date.localeCompare(b.date)||a.hour.localeCompare(b.hour));
  const currentVehicle = vehicles[selectedVeh];
  const vehicleReports = myReports.filter(r=>r.vehicleId===currentVehicle?.id);
  const mechRec = vehicleReports[0]?.observations;

  const STATUS_AP = { pending:{label:"Pendiente",color:CP.amber,bg:"#FEF3C7"}, confirmed:{label:"Confirmada",color:CP.green,bg:"#D1FAE5"}, cancelled:{label:"Cancelada",color:CP.red,bg:"#FEE2E2"}, done:{label:"Completada",color:CP.purple,bg:"#EDE9FE"} };
  const STATUS_OR = { active:{label:"En proceso",color:CP.amber,bg:"#FEF3C7"}, completed:{label:"Completada",color:CP.green,bg:"#D1FAE5"}, cancelled:{label:"Cancelada",color:CP.red,bg:"#FEE2E2"} };
  const STATUS_QU = { pending:{label:"Solicitada",color:CP.amber}, quoted:{label:"Cotizada",color:CP.blue}, sent:{label:"Enviada",color:CP.green}, closed:{label:"Cerrada",color:CP.purple} };

  const navItems = [
    { id:"home",    icon:"🏠", label:"Inicio" },
    { id:"book",    icon:"📅", label:"Cita" },
    { id:"quote",   icon:"💬", label:"Cotizar" },
    { id:"orders",  icon:"📋", label:"Órdenes" },
    { id:"history", icon:"📄", label:"Historial" },
    { id:"invoice", icon:"🧾", label:"Factura" },
  ];

  return (
    <div style={{ minHeight:"100vh", background:CP.bg, fontFamily:"'Inter',system-ui,sans-serif", color:CP.text, paddingBottom:72 }}>
      {/* TOP HEADER */}
      <div style={{ background:"linear-gradient(135deg,#1E3A5F,#2563EB)", padding:"16px 20px 20px", color:"#fff" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, background:"rgba(255,255,255,.2)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>🔧</div>
            <div>
              <div style={{ fontWeight:800, fontSize:15 }}>Tecno AutoAsisten CR</div>
              <div style={{ fontSize:11, opacity:.8 }}>Portal del Cliente</div>
            </div>
          </div>
          <button onClick={onLogout} style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:8, padding:"6px 12px", color:"#fff", fontSize:12, cursor:"pointer", fontWeight:600 }}>Salir</button>
        </div>

        {/* Greeting */}
        <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>
          Hola, {myClient?.name?.split(" ")[0] || session.email.split("@")[0]} 👋
        </div>
        <div style={{ fontSize:13, opacity:.8 }}>
          {upcomingAppts.length>0 ? `Tenés ${upcomingAppts.length} cita${upcomingAppts.length>1?"s":""} próxima${upcomingAppts.length>1?"s":""}` : "Sin citas próximas"}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding:"0 16px", marginTop:-8 }}>

        {/* REGISTRATION — if no client profile */}
        {!myClient && regStep!=="done" && (
          <div style={{ background:CP.card, borderRadius:16, padding:"20px", marginBottom:16, boxShadow:"0 2px 12px rgba(0,0,0,.08)" }}>
            <div style={{ fontWeight:700, fontSize:17, marginBottom:4, color:CP.text }}>
              {regStep==="client" ? "👤 Completá tu perfil" : "🚗 Agregá tu vehículo"}
            </div>
            <div style={{ fontSize:13, color:CP.textMd, marginBottom:16 }}>
              {regStep==="client" ? "Necesitamos tus datos para agendar citas." : "Registrá tu vehículo para empezar. (Opcional)"}
            </div>
            {regStep==="client" && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div style={{ gridColumn:"span 2" }}>
                  <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Nombre completo *</label>
                  <input value={regForm.name} onChange={e=>setRegForm(f=>({...f,name:e.target.value}))} style={ISC()} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Teléfono *</label>
                  <input value={regForm.phone} onChange={e=>setRegForm(f=>({...f,phone:e.target.value}))} style={ISC()} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Cédula</label>
                  <input value={regForm.idNum} onChange={e=>setRegForm(f=>({...f,idNum:e.target.value}))} style={ISC()} />
                </div>
              </div>
            )}
            {regStep==="vehicle" && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Placa *</label>
                  <input value={regForm.plate} onChange={e=>setRegForm(f=>({...f,plate:e.target.value.toUpperCase()}))} style={ISC()} placeholder="ABC-123" />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Marca *</label>
                  <input value={regForm.brand} onChange={e=>setRegForm(f=>({...f,brand:e.target.value}))} style={ISC()} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Modelo</label>
                  <input value={regForm.model} onChange={e=>setRegForm(f=>({...f,model:e.target.value}))} style={ISC()} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Año</label>
                  <input type="number" value={regForm.year} onChange={e=>setRegForm(f=>({...f,year:+e.target.value}))} style={ISC()} />
                </div>
              </div>
            )}
            {regError && <div style={{ color:CP.red, fontSize:13, marginTop:10 }}>❌ {regError}</div>}
            <div style={{ display:"flex", gap:10, marginTop:16 }}>
              <button onClick={submitRegistration} disabled={regLoading} style={{ flex:1, padding:"12px", borderRadius:10, border:"none", background:`linear-gradient(135deg,${CP.blue},${CP.cyan})`, color:"#fff", fontWeight:700, fontSize:15, cursor:"pointer" }}>
                {regLoading?"Guardando…":regStep==="client"?"Continuar →":"Guardar vehículo →"}
              </button>
              {regStep==="vehicle" && <button onClick={()=>setRegStep("done")} style={{ padding:"12px 16px", borderRadius:10, border:`1px solid ${CP.border}`, background:"transparent", color:CP.textMd, fontSize:14, cursor:"pointer" }}>Omitir</button>}
            </div>
          </div>
        )}

        {/* HOME TAB */}
        {tab==="home" && (
          <div>
            {/* Vehicle card */}
            {vehicles.length>0 && (
              <div style={{ background:CP.card, borderRadius:16, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,.08)", marginBottom:16 }}>
                {/* Vehicle selector if multiple */}
                {vehicles.length>1 && (
                  <div style={{ display:"flex", gap:8, padding:"12px 16px 0", overflowX:"auto" }}>
                    {vehicles.map((v,i)=>(
                      <button key={v.id} onClick={()=>setSelectedVeh(i)} style={{ padding:"6px 14px", borderRadius:20, border:`1px solid ${selectedVeh===i?CP.blue:CP.border}`, background:selectedVeh===i?`${CP.blue}11`:"transparent", color:selectedVeh===i?CP.blue:CP.textMd, cursor:"pointer", fontSize:12, fontWeight:selectedVeh===i?700:400, whiteSpace:"nowrap" }}>
                        {v.plate}
                      </button>
                    ))}
                  </div>
                )}
                {/* Vehicle photo */}
                {currentVehicle?.photoUrl ? (
                  <div style={{ height:180, overflow:"hidden", position:"relative" }}>
                    <img src={currentVehicle.photoUrl} alt={currentVehicle.plate} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                    <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(transparent,rgba(0,0,0,.7))", padding:"20px 16px 12px" }}>
                      <div style={{ fontWeight:800, fontSize:18, color:"#fff" }}>{currentVehicle.year} {currentVehicle.brand} {currentVehicle.model}</div>
                      <div style={{ fontSize:13, color:"rgba(255,255,255,.8)" }}>{currentVehicle.plate} · {currentVehicle.color} · {currentVehicle.fuel}</div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background:`linear-gradient(135deg,#1E3A5F,#2563EB)`, padding:"20px 16px", display:"flex", alignItems:"center", gap:14 }}>
                    <div style={{ width:56, height:56, background:"rgba(255,255,255,.15)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>🚗</div>
                    <div>
                      <div style={{ fontWeight:800, fontSize:18, color:"#fff" }}>{currentVehicle?.year} {currentVehicle?.brand} {currentVehicle?.model}</div>
                      <div style={{ fontSize:13, color:"rgba(255,255,255,.8)" }}>{currentVehicle?.plate} · {currentVehicle?.color} · {currentVehicle?.fuel}</div>
                    </div>
                  </div>
                )}
                {/* Vehicle stats */}
                <div style={{ padding:"14px 16px" }}>
                  <div style={{ display:"flex", gap:16, marginBottom:currentVehicle?.km?12:0 }}>
                    {currentVehicle?.km>0 && <div><div style={{ fontSize:10, color:CP.textSm, textTransform:"uppercase", letterSpacing:.7 }}>Kilometraje</div><div style={{ fontWeight:700, fontSize:15, color:CP.text }}>{Number(currentVehicle.km).toLocaleString()} km</div></div>}
                    <div><div style={{ fontSize:10, color:CP.textSm, textTransform:"uppercase", letterSpacing:.7 }}>Órdenes</div><div style={{ fontWeight:700, fontSize:15, color:CP.text }}>{orders.filter(o=>o.vehicleId===currentVehicle?.id).length}</div></div>
                    <div><div style={{ fontSize:10, color:CP.textSm, textTransform:"uppercase", letterSpacing:.7 }}>Informes</div><div style={{ fontWeight:700, fontSize:15, color:CP.text }}>{vehicleReports.length}</div></div>
                  </div>
                  {/* Mechanic recommendation */}
                  {mechRec && (
                    <div style={{ background:"#FFF7ED", border:`1px solid ${CP.amber}44`, borderRadius:10, padding:"10px 12px", marginTop:4 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:CP.amber, textTransform:"uppercase", letterSpacing:.7, marginBottom:3 }}>💡 Recomendación del mecánico</div>
                      <div style={{ fontSize:13, color:"#92400E" }}>{mechRec}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No vehicle */}
            {vehicles.length===0 && myClient && (
              <div style={{ background:CP.card, borderRadius:16, padding:"20px", boxShadow:"0 2px 12px rgba(0,0,0,.08)", marginBottom:16, textAlign:"center" }}>
                <div style={{ fontSize:40, marginBottom:8 }}>🚗</div>
                <div style={{ fontWeight:600, color:CP.text, marginBottom:4 }}>Sin vehículos registrados</div>
                <div style={{ fontSize:13, color:CP.textMd }}>El taller registrará tu vehículo en tu próxima visita.</div>
              </div>
            )}

            {/* Upcoming appointments */}
            <div style={{ background:CP.card, borderRadius:16, padding:"16px", boxShadow:"0 2px 12px rgba(0,0,0,.08)", marginBottom:16 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <div style={{ fontWeight:700, fontSize:16 }}>📅 Próximas citas</div>
                <button onClick={()=>setTab("book")} style={{ fontSize:12, color:CP.blue, background:"none", border:"none", cursor:"pointer", fontWeight:600 }}>+ Agendar</button>
              </div>
              {upcomingAppts.length===0 ? (
                <div style={{ textAlign:"center", padding:"16px 0", color:CP.textSm, fontSize:13 }}>
                  Sin citas próximas ·{" "}
                  <span onClick={()=>setTab("book")} style={{ color:CP.blue, cursor:"pointer", fontWeight:600 }}>Agendar una</span>
                </div>
              ) : upcomingAppts.slice(0,3).map(a=>{
                const svc = a.serviceId==="__custom__"?(a.customService||"Servicio personalizado"):(services.find(s=>s.id===a.serviceId)?.name||a.serviceId);
                const sc  = STATUS_AP[a.status]||STATUS_AP.pending;
                return (
                  <div key={a.id} style={{ display:"flex", gap:12, alignItems:"center", padding:"10px 0", borderBottom:`1px solid ${CP.border}` }}>
                    <div style={{ background:`linear-gradient(135deg,${CP.blue},${CP.cyan})`, borderRadius:10, padding:"8px 10px", textAlign:"center", minWidth:52, flexShrink:0 }}>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,.8)" }}>{a.date.slice(5).replace("-","/")}</div>
                      <div style={{ fontWeight:800, color:"#fff", fontSize:14 }}>{a.hour}</div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:14 }}>{svc}</div>
                      <div style={{ fontSize:12, color:CP.textMd }}>{a.mechanic||"Por asignar"}</div>
                    </div>
                    <span style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{sc.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Active orders */}
            {orders.filter(o=>o.status==="active").length>0 && (
              <div style={{ background:CP.card, borderRadius:16, padding:"16px", boxShadow:"0 2px 12px rgba(0,0,0,.08)", marginBottom:16 }}>
                <div style={{ fontWeight:700, fontSize:16, marginBottom:14 }}>🔧 En proceso</div>
                {orders.filter(o=>o.status==="active").map(o=>(
                  <div key={o.id} style={{ padding:"10px 0", borderBottom:`1px solid ${CP.border}` }}>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <div style={{ fontWeight:600, fontSize:14 }}>{o.services.map(sid=>services.find(s=>s.id===sid)?.name).filter(Boolean).join(", ")||"Servicio"}</div>
                      <span style={{ background:"#FEF3C7", color:CP.amber, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>En proceso</span>
                    </div>
                    <div style={{ fontSize:12, color:CP.textMd, marginTop:2 }}>{o.mechanic} · {fmtDate(o.date)}</div>
                    {o.mechanicNotes && <div style={{ fontSize:12, color:CP.blue, marginTop:4, background:"#EFF6FF", borderRadius:6, padding:"6px 10px" }}>🔧 {o.mechanicNotes}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Quick actions */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
              {[
                { icon:"📅", label:"Agendar cita", tab:"book", color:CP.blue },
                { icon:"💬", label:"Solicitar cotización", tab:"quote", color:CP.purple },
                { icon:"📋", label:"Mis órdenes", tab:"orders", color:CP.green },
                { icon:"📄", label:"Historial", tab:"history", color:CP.amber },
              ].map(a=>(
                <button key={a.tab} onClick={()=>setTab(a.tab)} style={{ background:CP.card, border:`1px solid ${CP.border}`, borderRadius:14, padding:"16px 14px", textAlign:"left", cursor:"pointer", boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
                  <div style={{ fontSize:24, marginBottom:6 }}>{a.icon}</div>
                  <div style={{ fontWeight:600, fontSize:13, color:CP.text }}>{a.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* BOOK APPOINTMENT */}
        {tab==="book" && (
          <div style={{ background:CP.card, borderRadius:16, padding:"20px", boxShadow:"0 2px 12px rgba(0,0,0,.08)" }}>
            <div style={{ fontWeight:700, fontSize:18, marginBottom:4, color:CP.text }}>📅 Agendar cita</div>
            <div style={{ fontSize:13, color:CP.textMd, marginBottom:20 }}>Horario: {SCHEDULE_LABEL}</div>
            {apptDone && <div style={{ background:"#D1FAE5", border:`1px solid ${CP.green}`, borderRadius:10, padding:"12px 16px", marginBottom:16, color:"#065F46", fontWeight:600 }}>✅ ¡Cita agendada! El taller confirmará pronto.</div>}
            {!myClient ? <div style={{ color:CP.amber, fontSize:14 }}>⬆️ Completá tu perfil primero.</div> : vehicles.length===0 ? <div style={{ color:CP.textMd, fontSize:14 }}>El taller registrará tu vehículo en tu primera visita.</div> : (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Vehículo</label>
                  <select value={apptForm.vehicleId} onChange={e=>setApptForm(f=>({...f,vehicleId:e.target.value}))} style={ISC()}>
                    {vehicles.map(v=><option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Servicio</label>
                  <select value={apptForm.serviceId} onChange={e=>setApptForm(f=>({...f,serviceId:e.target.value}))} style={ISC()}>
                    {services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    <option value="__custom__">✏️ Escribir manualmente…</option>
                  </select>
                </div>
                {apptForm.serviceId==="__custom__" && (
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Describí el servicio</label>
                    <input value={apptForm.customService||""} onChange={e=>setApptForm(f=>({...f,customService:e.target.value}))} placeholder="Ej: Cambio de correa de distribución…" style={ISC()} />
                  </div>
                )}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Fecha</label>
                    <input type="date" value={apptForm.date} min={today()} onChange={e=>{ const nd=e.target.value; const vh=getHoursForDate(nd); setApptForm(f=>({...f,date:nd,hour:vh[0]||""})); }} style={ISC()} />
                    {apptForm.date && !isWorkingDay(apptForm.date) && <div style={{ fontSize:11, color:CP.red, marginTop:4 }}>⚠️ Cerrado los domingos.</div>}
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Hora</label>
                    <select value={apptForm.hour} onChange={e=>setApptForm(f=>({...f,hour:e.target.value}))} style={ISC()} disabled={!isWorkingDay(apptForm.date)}>
                      {getHoursForDate(apptForm.date).length===0 ? <option>No disponible</option> : getHoursForDate(apptForm.date).map(h=><option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Notas (opcional)</label>
                  <textarea value={apptForm.notes} onChange={e=>setApptForm(f=>({...f,notes:e.target.value}))} rows={3} placeholder="Describí el problema o lo que necesitás revisar…" style={{...ISC(),resize:"vertical"}} />
                </div>
                <button onClick={bookAppointment} disabled={apptLoading||!isWorkingDay(apptForm.date)||!apptForm.hour} style={{ padding:"14px", borderRadius:12, border:"none", background:(apptLoading||!isWorkingDay(apptForm.date)||!apptForm.hour)?"#CBD5E1":`linear-gradient(135deg,${CP.blue},${CP.cyan})`, color:"#fff", fontWeight:700, fontSize:16, cursor:"pointer" }}>
                  {apptLoading?"Agendando…":"📅 Confirmar cita"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* QUOTE */}
        {tab==="quote" && (
          <div style={{ background:CP.card, borderRadius:16, padding:"20px", boxShadow:"0 2px 12px rgba(0,0,0,.08)" }}>
            <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>💬 Solicitar cotización</div>
            <div style={{ fontSize:13, color:CP.textMd, marginBottom:20 }}>Describí lo que necesitás y te enviamos el precio por WhatsApp.</div>
            {quoteDone ? (
              <div style={{ background:"#D1FAE5", borderRadius:12, padding:"20px", textAlign:"center" }}>
                <div style={{ fontSize:40, marginBottom:8 }}>✅</div>
                <div style={{ fontWeight:700, color:"#065F46" }}>¡Solicitud enviada! Te contactamos pronto.</div>
              </div>
            ) : !myClient ? <div style={{ color:CP.amber, fontSize:14 }}>⬆️ Completá tu perfil primero.</div> : (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {vehicles.length>0 && (
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Vehículo (opcional)</label>
                    <select value={quoteVehicle} onChange={e=>setQuoteVehicle(e.target.value)} style={ISC()}>
                      <option value="">Sin especificar</option>
                      {vehicles.map(v=><option key={v.id} value={v.id}>{v.plate} — {v.brand} {v.model}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:8 }}>Tipo de servicio *</label>
                  <div style={{ display:"flex", gap:10 }}>
                    {[["diagnosis","🔍 Diagnóstico","Identificar el problema"],["repair","🔧 Reparación","Arreglar un problema conocido"],["warranty","🛡️ Garantía","Revisión bajo garantía"]].map(([v,l,d])=>(
                      <button key={v} onClick={()=>setQuoteType(v)} style={{ flex:1, textAlign:"left", padding:"12px 10px", borderRadius:10, border:`1px solid ${quoteType===v?CP.blue:CP.border}`, background:quoteType===v?`${CP.blue}11`:"transparent", cursor:"pointer" }}>
                        <div style={{ fontWeight:700, fontSize:12, color:quoteType===v?CP.blue:CP.text }}>{l}</div>
                        <div style={{ fontSize:10, color:CP.textSm, marginTop:2 }}>{d}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Describí el problema *</label>
                  <textarea value={quoteFailure} onChange={e=>setQuoteFailure(e.target.value)} rows={4} placeholder="Ej: El carro hace un ruido al frenar, la luz de check está encendida…" style={{...ISC(),resize:"vertical"}} />
                </div>
                <button onClick={submitQuote} disabled={quoteLoading||!quoteType||!quoteFailure.trim()} style={{ padding:"14px", borderRadius:12, border:"none", background:(quoteLoading||!quoteType||!quoteFailure.trim())?"#CBD5E1":`linear-gradient(135deg,${CP.purple},${CP.blue})`, color:"#fff", fontWeight:700, fontSize:16, cursor:"pointer" }}>
                  {quoteLoading?"Enviando…":"💬 Solicitar cotización"}
                </button>

                {/* Quote history */}
                {myQuotes.length>0 && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ fontWeight:700, fontSize:15, marginBottom:10 }}>Mis cotizaciones</div>
                    {myQuotes.map(q=>{
                      const sc=STATUS_QU[q.status]||STATUS_QU.pending;
                      return (
                        <div key={q.id} style={{ background:"#F8FAFC", borderRadius:10, padding:"12px 14px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div>
                            <div style={{ fontWeight:600, fontSize:13 }}>{q.quoteType==="diagnosis"?"🔍 Diagnóstico":q.quoteType==="repair"?"🔧 Reparación":"🛡️ Garantía"}</div>
                            <div style={{ fontSize:12, color:CP.textMd, marginTop:2 }}>{q.possibleFailure?.slice(0,50)}{q.possibleFailure?.length>50?"…":""}</div>
                            {q.total>0 && <div style={{ fontWeight:700, color:CP.green, marginTop:4 }}>{fmtCRC(q.total)}</div>}
                          </div>
                          <span style={{ background:`${sc.color}22`, color:sc.color, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{sc.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ORDERS */}
        {tab==="orders" && (
          <div>
            <div style={{ fontWeight:700, fontSize:18, marginBottom:16 }}>📋 Mis órdenes</div>
            {orders.length===0 && <div style={{ background:CP.card, borderRadius:16, padding:"30px", textAlign:"center", color:CP.textSm, boxShadow:"0 2px 12px rgba(0,0,0,.08)" }}>Sin órdenes registradas</div>}
            {[...orders].sort((a,b)=>b.date.localeCompare(a.date)).map(o=>{
              const sc=STATUS_OR[o.status]||STATUS_OR.active;
              return (
                <div key={o.id} style={{ background:CP.card, borderRadius:16, padding:"16px", marginBottom:12, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ fontWeight:700, fontSize:15 }}>{fmtDate(o.date)}</div>
                    <span style={{ background:sc.bg, color:sc.color, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>{sc.label}</span>
                  </div>
                  <div style={{ fontSize:13, color:CP.textMd }}>{o.services.map(sid=>services.find(s=>s.id===sid)?.name).filter(Boolean).join(", ")||"Servicio"}</div>
                  <div style={{ fontSize:12, color:CP.textSm, marginTop:2 }}>{o.mechanic}</div>
                  {o.mechanicNotes && <div style={{ fontSize:12, color:CP.blue, marginTop:8, background:"#EFF6FF", borderRadius:8, padding:"8px 10px" }}>🔧 {o.mechanicNotes}</div>}
                  {o.total>0 && <div style={{ fontWeight:800, fontSize:17, color:CP.green, marginTop:10 }}>{fmtCRC(o.total)}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* HISTORY */}
        {tab==="history" && (
          <div>
            <div style={{ fontWeight:700, fontSize:18, marginBottom:16 }}>📄 Historial de servicios</div>
            {myReports.length===0 && <div style={{ background:CP.card, borderRadius:16, padding:"30px", textAlign:"center", color:CP.textSm, boxShadow:"0 2px 12px rgba(0,0,0,.08)" }}>Sin informes de servicio aún</div>}
            {[...myReports].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")).map(r=>{
              const v=vehicles.find(x=>x.id===r.vehicleId);
              const o=orders.find(x=>x.id===r.orderId);
              return (
                <div key={r.id} style={{ background:CP.card, borderRadius:16, padding:"18px", marginBottom:12, boxShadow:"0 2px 8px rgba(0,0,0,.06)" }}>
                  <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>📋 Informe de servicio</div>
                  <div style={{ fontSize:12, color:CP.textSm, marginBottom:12 }}>{v&&`${v.plate} · ${v.brand} ${v.model}`} · {fmtDate(o?.date||r.createdAt?.slice(0,10))} · {r.mechanic}{r.kmAtService>0?` · ${Number(r.kmAtService).toLocaleString()} km`:""}</div>
                  {o?.services?.length>0 && (
                    <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                      {o.services.map(sid=>{ const s=services.find(x=>x.id===sid); return s?<span key={sid} style={{ background:"#D1FAE5", color:"#065F46", borderRadius:6, padding:"3px 10px", fontSize:12, fontWeight:600 }}>✅ {s.name}</span>:null; })}
                    </div>
                  )}
                  <div style={{ fontSize:13, color:CP.text, marginBottom:r.observations?10:0, lineHeight:1.6 }}>{r.worksDone}</div>
                  {r.observations && <div style={{ background:"#FFF7ED", border:`1px solid ${CP.amber}44`, borderRadius:10, padding:"10px 12px", fontSize:13, color:"#92400E" }}>💡 {r.observations}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* INVOICE */}
        {tab==="invoice" && (
          <div style={{ background:CP.card, borderRadius:16, padding:"20px", boxShadow:"0 2px 12px rgba(0,0,0,.08)" }}>
            <div style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>🧾 Factura electrónica</div>
            <div style={{ fontSize:13, color:CP.textMd, marginBottom:20 }}>Llenás tus datos fiscales y te enviamos la factura.</div>
            {invDone ? (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:48, marginBottom:10 }}>✅</div>
                <div style={{ fontWeight:700, color:CP.green, fontSize:16 }}>¡Solicitud enviada!</div>
                <div style={{ color:CP.textMd, fontSize:13, marginTop:6 }}>Te enviamos la factura al correo indicado.</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Nombre legal / Razón social *</label>
                  <input value={invForm.legalName} onChange={e=>setInvForm(f=>({...f,legalName:e.target.value}))} style={ISC()} />
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Cédula / RUC *</label>
                    <input value={invForm.idNum} onChange={e=>setInvForm(f=>({...f,idNum:e.target.value}))} style={ISC()} />
                  </div>
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Teléfono</label>
                    <input value={invForm.phone} onChange={e=>setInvForm(f=>({...f,phone:e.target.value}))} style={ISC()} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Correo para envío *</label>
                  <input value={invForm.email} onChange={e=>setInvForm(f=>({...f,email:e.target.value}))} style={ISC()} />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Dirección fiscal</label>
                  <input value={invForm.address} onChange={e=>setInvForm(f=>({...f,address:e.target.value}))} style={ISC()} />
                </div>
                {orders.length>0 && (
                  <div>
                    <label style={{ fontSize:12, fontWeight:600, color:CP.textMd, display:"block", marginBottom:4 }}>Orden asociada (opcional)</label>
                    <select value={invForm.orderId} onChange={e=>setInvForm(f=>({...f,orderId:e.target.value}))} style={ISC()}>
                      <option value="">— Seleccionar —</option>
                      {orders.map(o=><option key={o.id} value={o.id}>{fmtDate(o.date)} · {fmtCRC(o.total)}</option>)}
                    </select>
                  </div>
                )}
                <button onClick={async()=>{ if(!invForm.legalName.trim()||!invForm.idNum.trim()) return; setInvLoad(true); const ni={id:uid(),clientId:myClient?.id||"",orderId:invForm.orderId||null,legalName:invForm.legalName.trim(),idNum:invForm.idNum.trim(),address:invForm.address.trim(),email:invForm.email.trim(),phone:invForm.phone.trim(),status:"pending",notes:invForm.notes.trim(),createdAt:new Date().toISOString()}; await sb.upsert("invoices",TABLE.invoices.toDb(ni)); setInvDone(true); setInvLoad(false); }} disabled={invLoad||!invForm.legalName.trim()||!invForm.idNum.trim()} style={{ padding:"14px", borderRadius:12, border:"none", background:(invLoad||!invForm.legalName.trim()||!invForm.idNum.trim())?"#CBD5E1":`linear-gradient(135deg,${CP.blue},${CP.cyan})`, color:"#fff", fontWeight:700, fontSize:16, cursor:"pointer" }}>
                  {invLoad?"Enviando…":"🧾 Solicitar factura"}
                </button>
                {myInvoices.length>0 && (
                  <div style={{ marginTop:8 }}>
                    <div style={{ fontWeight:700, fontSize:15, marginBottom:10 }}>Mis facturas</div>
                    {myInvoices.map(inv=>(
                      <div key={inv.id} style={{ background:"#F8FAFC", borderRadius:10, padding:"12px 14px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div>
                          <div style={{ fontWeight:600, fontSize:13 }}>{inv.legalName}</div>
                          <div style={{ fontSize:12, color:CP.textSm }}>{fmtDate(inv.createdAt?.slice(0,10))}</div>
                        </div>
                        <span style={{ background:inv.status==="sent"?"#D1FAE5":"#FEF3C7", color:inv.status==="sent"?CP.green:CP.amber, borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
                          {inv.status==="sent"?"Enviada":"Pendiente"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>

      {/* BOTTOM NAV */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:CP.navBg, borderTop:`1px solid rgba(255,255,255,.1)`, display:"flex", zIndex:100, paddingBottom:"env(safe-area-inset-bottom,0px)" }}>
        {navItems.map(n=>(
          <button key={n.id} onClick={()=>setTab(n.id)} style={{ flex:1, padding:"10px 4px 8px", border:"none", background:"transparent", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <span style={{ fontSize:20 }}>{n.icon}</span>
            <span style={{ fontSize:10, fontWeight:tab===n.id?700:400, color:tab===n.id?"#60A5FA":"rgba(255,255,255,.5)" }}>{n.label}</span>
            {tab===n.id && <div style={{ width:4, height:4, borderRadius:"50%", background:"#60A5FA", marginTop:1 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

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
                  <PasswordField value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                </div>
                <div>
                  <label style={{ fontSize:12, fontWeight:600, color:C.textSm, display:"block", marginBottom:5 }}>Confirmar contraseña</label>
                  <PasswordField value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSubmit()} placeholder="Repetí la contraseña" />
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

/* ═══════════════════════════════════════════════════
   SERVICE REPORT MODAL — Informe de servicio
═══════════════════════════════════════════════════ */
function ServiceReportModal({ order, data, existing, onSave, onClose }) {
  const client  = data.clients.find(c=>c.id===order.clientId);
  const vehicle = data.vehicles.find(v=>v.id===order.vehicleId);
  const [f, setF] = useState(existing || {
    id: uid(), orderId: order.id, clientId: order.clientId, vehicleId: order.vehicleId,
    mechanic: order.mechanic||"", worksDone: "", observations: "",
    kmAtService: vehicle?.km||0, createdAt: new Date().toISOString()
  });
  const set = (k,v) => setF(p=>({...p,[k]:v}));

  return (
    <Modal title="📋 Informe de servicio" onClose={onClose} wide>
      {/* Header info */}
      <div style={{ background:C.bg, borderRadius:10, padding:"14px 16px", marginBottom:16, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:C.textSm, textTransform:"uppercase", letterSpacing:.7, marginBottom:3 }}>Cliente</div>
          <div style={{ fontWeight:700 }}>{client?.name||"—"}</div>
        </div>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:C.textSm, textTransform:"uppercase", letterSpacing:.7, marginBottom:3 }}>Vehículo</div>
          <div style={{ fontWeight:700 }}>{vehicle?.plate} — {vehicle?.year} {vehicle?.brand} {vehicle?.model}</div>
        </div>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:C.textSm, textTransform:"uppercase", letterSpacing:.7, marginBottom:3 }}>Fecha</div>
          <div>{fmtDate(order.date)}</div>
        </div>
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:C.textSm, textTransform:"uppercase", letterSpacing:.7, marginBottom:3 }}>Mecánico</div>
          <div>{order.mechanic||"—"}</div>
        </div>
      </div>

      {/* Servicios realizados */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:600, color:C.textSm, marginBottom:6 }}>Servicios realizados</div>
        <div style={{ background:C.bg, borderRadius:8, padding:"10px 12px", fontSize:13 }}>
          {order.services.map(sid=>(data.services||SERVICES_CAT).find(s=>s.id===sid)?.name).filter(Boolean).map((n,i)=>(
            <div key={i} style={{ padding:"3px 0", borderBottom:`1px solid ${C.border}` }}>✅ {n}</div>
          ))}
          {order.parts?.length>0 && order.parts.map((p,i)=>(
            <div key={`p${i}`} style={{ padding:"3px 0", borderBottom:`1px solid ${C.border}`, color:C.textSm }}>🔩 {p.name} × {p.qty}</div>
          ))}
        </div>
      </div>

      <Field label="Trabajos realizados *">
        <textarea value={f.worksDone} onChange={e=>set("worksDone",e.target.value)} rows={4} placeholder="Ej: Se realizó cambio de aceite y filtro. Se inspeccionaron frenos delanteros y traseros encontrándose en buen estado…" style={{...IS(),resize:"vertical"}} />
      </Field>

      <div style={{ marginTop:14 }}>
        <Field label="Observaciones / Recomendaciones">
          <textarea value={f.observations} onChange={e=>set("observations",e.target.value)} rows={3} placeholder="Ej: Se recomienda revisión de llantas en próxima visita. Nivel de refrigerante bajo, se recomendó al cliente…" style={{...IS(),resize:"vertical"}} />
        </Field>
      </div>

      <div style={{ marginTop:14 }}>
        <Field label="Kilometraje al momento del servicio">
          <input type="number" value={f.kmAtService} onChange={e=>set("kmAtService",+e.target.value)} style={IS()} placeholder="Ej: 87500" />
        </Field>
      </div>

      <div style={{ background:`${C.green}11`, border:`1px solid ${C.green}33`, borderRadius:8, padding:"10px 14px", marginTop:14, fontSize:12, color:C.green }}>
        📱 Este informe quedará visible para el cliente en su historial de vehículo dentro de la app.
      </div>

      <ModalActions onSave={()=>{ if(f.worksDone.trim()) onSave(f); }} onClose={onClose} />
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════
   AI ASSISTANT PAGE — Asistente con acceso a datos reales
═══════════════════════════════════════════════════ */
function AIAssistantPage({ data, save, toast }) {
  const [history, setHistory] = useState([
    { role:"assistant", content:"¡Hola! Soy el asistente de Tecno AutoAsisten CR. Tengo acceso completo a los datos del taller. Puedo responder preguntas como:\n\n• ¿Cuántas citas tengo hoy?\n• ¿Qué órdenes están activas?\n• ¿Cuánto ingresé este mes?\n• ¿Quién es el cliente con más órdenes?\n\nTambién puedo ayudarte a actualizar estados de órdenes y citas. ¿En qué te ayudo?" }
  ]);
  const [question, setQuestion] = useState("");
  const [loading,  setLoading]  = useState(false);
  const endRef = useRef(null);

  const buildContext = () => {
    const today = new Date().toISOString().slice(0,10);
    const thisMonth = new Date().toISOString().slice(0,7);
    const todayAppts = (data.appointments||[]).filter(a=>a.date===today);
    const activeOrders = (data.orders||[]).filter(o=>o.status==="active");
    const monthIncome = (data.orders||[]).filter(o=>o.status==="completed" && o.date?.startsWith(thisMonth)).reduce((s,o)=>s+o.total,0);
    const pendingAppts = (data.appointments||[]).filter(a=>a.status==="pending");

    return `Eres el asistente administrativo de Tecno AutoAsisten CR, un taller mecánico en Costa Rica.
Hoy es ${today}. Moneda: Colones (₡).

DATOS ACTUALES DEL TALLER:
- Clientes: ${data.clients?.length||0}
- Vehículos: ${data.vehicles?.length||0}
- Citas HOY (${today}): ${todayAppts.length} → ${todayAppts.map(a=>{const c=data.clients?.find(x=>x.id===a.clientId);return `${c?.name||"?"} a las ${a.hour} (${a.status})`;}).join(", ")||"Ninguna"}
- Citas pendientes de confirmar: ${pendingAppts.length}
- Órdenes activas: ${activeOrders.length} → ${activeOrders.map(o=>{const c=data.clients?.find(x=>x.id===o.clientId);return `${c?.name||"?"} (₡${o.total})`;}).join(", ")||"Ninguna"}
- Ingresos del mes (${thisMonth}): ₡${monthIncome.toLocaleString("es-CR")}
- Trabajadores activos: ${(data.workers||[]).filter(w=>w.status==="active").map(w=>w.name).join(", ")||"Ninguno"}
- Inventario con stock bajo: ${(data.inventory||[]).filter(i=>i.qty<=i.minQty).map(i=>i.name).join(", ")||"Ninguno"}

LISTA DE CITAS (próximas 7 días):
${(data.appointments||[]).filter(a=>a.date>=today).slice(0,10).map(a=>{
  const c=data.clients?.find(x=>x.id===a.clientId);
  const v=data.vehicles?.find(x=>x.id===a.vehicleId);
  return `ID:${a.id} | ${a.date} ${a.hour} | ${c?.name||"?"} | ${v?.plate||"?"} | ${a.status}`;
}).join("\n")||"Ninguna"}

ÓRDENES ACTIVAS:
${activeOrders.map(o=>{const c=data.clients?.find(x=>x.id===o.clientId);return `ID:${o.id} | ${c?.name||"?"} | ₡${o.total} | ${o.mechanic}`;}).join("\n")||"Ninguna"}

Responde en español de Costa Rica. Sé conciso y práctico. Si el usuario pide actualizar algo, incluye al final del mensaje una línea con formato JSON así:
ACTION: {"type":"update_appointment","id":"xxx","status":"confirmed"}
o: ACTION: {"type":"update_order","id":"xxx","status":"completed"}
Solo incluye ACTION si el usuario explícitamente pide hacer un cambio.`;
  };

  const handleAction = async (actionStr) => {
    try {
      const action = JSON.parse(actionStr);
      if (action.type === "update_appointment") {
        const list = (data.appointments||[]).map(a=>a.id===action.id?{...a,status:action.status}:a);
        save({ appointments:list });
        toast(`Cita actualizada a: ${action.status}`);
      } else if (action.type === "update_order") {
        const list = (data.orders||[]).map(o=>o.id===action.id?{...o,status:action.status}:o);
        save({ orders:list });
        toast(`Orden actualizada a: ${action.status}`);
      }
    } catch(e) { console.error("Action parse error:", e); }
  };

  const send = async () => {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setQuestion("");
    const newHistory = [...history, { role:"user", content:q }];
    setHistory(newHistory);
    setLoading(true);

    try {
      const msgs = newHistory.map(m=>({ role:m.role, content:m.content }));
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:1000,
          system: buildContext(),
          messages: msgs
        })
      });
      const d = await res.json();
      let answer = d.content?.map(b=>b.text||"").join("") || "Sin respuesta.";

      // Extract and execute action if present
      const actionMatch = answer.match(/ACTION:\s*(\{[^}]+\})/);
      if (actionMatch) {
        await handleAction(actionMatch[1]);
        answer = answer.replace(/ACTION:\s*\{[^}]+\}/, "").trim();
        answer += "\n\n✅ Acción ejecutada correctamente.";
      }

      setHistory(h=>[...h, { role:"assistant", content:answer }]);
    } catch(e) {
      setHistory(h=>[...h, { role:"assistant", content:"Error al conectar. Intentá de nuevo." }]);
    }
    setLoading(false);
    setTimeout(()=>endRef.current?.scrollIntoView({ behavior:"smooth" }),100);
  };

  // Quick action buttons
  const quickActions = [
    "¿Cuántas citas tengo hoy?",
    "¿Qué órdenes están activas?",
    "¿Cuánto ingresé este mes?",
    "¿Hay productos con stock bajo?",
    "¿Cuántas citas pendientes de confirmar?",
    "Resumen del taller hoy",
  ];

  return (
    <div style={{ maxWidth:800, margin:"0 auto", display:"flex", flexDirection:"column", height:"calc(100vh - 160px)" }}>
      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:`linear-gradient(135deg,${C.purple},${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>🧠</div>
          <div>
            <div style={{ fontWeight:800, fontSize:20 }}>Asistente IA del Taller</div>
            <div style={{ fontSize:13, color:C.textMd }}>Preguntá sobre citas, órdenes, clientes, ingresos — o pedile que actualice estados.</div>
          </div>
        </div>
        <div style={{ background:`${C.purple}11`, border:`1px solid ${C.purple}33`, borderRadius:8, padding:"8px 14px", fontSize:12, color:C.purple }}>
          ✨ Potenciado por Claude AI · Acceso a datos reales del taller
        </div>
      </div>

      {/* Quick actions */}
      {history.length<=1 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:12, color:C.textSm, marginBottom:8 }}>Acciones rápidas:</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {quickActions.map(q=>(
              <button key={q} onClick={()=>setQuestion(q)} style={{ padding:"6px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:C.card, color:C.textMd, cursor:"pointer", fontSize:12, transition:"all .1s" }}>
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat */}
      <div style={{ flex:1, overflowY:"auto", border:`1px solid ${C.border}`, borderRadius:12, padding:"16px", marginBottom:14, background:C.card, display:"flex", flexDirection:"column", gap:16 }}>
        {history.map((m,i)=>(
          <div key={i} style={{ display:"flex", gap:10, justifyContent:m.role==="user"?"flex-end":"flex-start" }}>
            {m.role==="assistant" && (
              <div style={{ width:34, height:34, borderRadius:"50%", background:`linear-gradient(135deg,${C.purple},${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>🧠</div>
            )}
            <div style={{ maxWidth:"78%", background:m.role==="user"?`${C.blue}22`:C.bg, border:`1px solid ${m.role==="user"?C.blueHi:C.border}`, borderRadius:12, padding:"12px 16px", fontSize:13, lineHeight:1.7, whiteSpace:"pre-wrap" }}>
              {m.content}
            </div>
            {m.role==="user" && (
              <div style={{ width:34, height:34, borderRadius:"50%", background:`linear-gradient(135deg,${C.blue},${C.cyan})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>👤</div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display:"flex", gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:"50%", background:`linear-gradient(135deg,${C.purple},${C.blue})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🧠</div>
            <div style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:12, padding:"12px 16px", display:"flex", alignItems:"center", gap:8, color:C.textMd, fontSize:13 }}>
              <Spinner />Consultando datos del taller…
            </div>
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
          placeholder="Preguntá algo o pedí una acción… (Enter para enviar)"
          style={{...IS(), flex:1, padding:"12px 16px", fontSize:14}}
        />
        <button onClick={send} disabled={loading||!question.trim()} style={{ padding:"12px 20px", borderRadius:10, border:"none", background:loading||!question.trim()?C.border:`linear-gradient(135deg,${C.purple},${C.blue})`, color:"#fff", fontWeight:700, cursor:loading||!question.trim()?"default":"pointer", fontSize:16 }}>→</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   INVOICES PAGE — Admin gestión de facturas
═══════════════════════════════════════════════════ */
function InvoicesPage({ data, save, toast }) {
  const [filter, setFilter] = useState("all");
  const [delId,  setDelId]  = useState(null);

  const invoices = data.invoices || [];
  const filtered = filter==="all" ? invoices : invoices.filter(i=>i.status===filter);
  const sorted   = [...filtered].sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));

  const upd = (id, patch) => {
    save({ invoices: invoices.map(i=>i.id===id?{...i,...patch}:i) });
    toast("Estado actualizado");
  };
  const del = (id) => { save({ invoices: invoices.filter(i=>i.id!==id) }); toast("Eliminada","err"); setDelId(null); };

  const STATUS_INV = {
    pending:    { label:"Pendiente",   color:"#F59E0B", bg:"#2D1A00" },
    processing: { label:"En proceso",  color:"#3B82F6", bg:"#001A2D" },
    sent:       { label:"Enviada",     color:"#10B981", bg:"#002D1A" },
    cancelled:  { label:"Cancelada",   color:"#EF4444", bg:"#2D0000" },
  };

  const buildPDF = (inv) => {
    const client = data.clients.find(c=>c.id===inv.clientId);
    const order  = inv.orderId ? data.orders.find(o=>o.id===inv.orderId) : null;
    const svcLines = order ? order.services.map(sid=>{
      const s=(data.services||SERVICES_CAT).find(x=>x.id===sid);
      return s ? `${s.name}: ${fmtCRC(s.price)}` : null;
    }).filter(Boolean) : [];

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Factura - Tecno AutoAsisten CR</title>
<style>body{font-family:Arial,sans-serif;max-width:700px;margin:40px auto;color:#111;padding:20px}
h1{color:#1e3a5f;border-bottom:3px solid #1e3a5f;padding-bottom:10px}
.header{display:flex;justify-content:space-between;margin-bottom:30px}
.section{margin-bottom:20px}.section h3{color:#444;border-bottom:1px solid #ddd;padding-bottom:5px}
table{width:100%;border-collapse:collapse}.table td,.table th{padding:8px;border:1px solid #ddd;text-align:left}
.table th{background:#f0f4ff}.total{font-size:20px;font-weight:bold;color:#1e3a5f;text-align:right;margin-top:15px}
.footer{margin-top:40px;text-align:center;color:#888;font-size:12px;border-top:1px solid #ddd;padding-top:15px}
</style></head><body>
<h1>🔧 Tecno AutoAsisten CR</h1>
<div class="header">
  <div><strong>FACTURA ELECTRÓNICA</strong><br>Fecha: ${new Date().toLocaleDateString("es-CR")}<br>N°: FAC-${inv.id?.slice(0,6).toUpperCase()}</div>
  <div style="text-align:right">Estado: <strong>${STATUS_INV[inv.status]?.label||"Pendiente"}</strong></div>
</div>
<div class="section"><h3>Datos del cliente</h3>
<p><strong>Nombre:</strong> ${inv.legalName}</p>
<p><strong>Cédula/RUC:</strong> ${inv.idNum}</p>
<p><strong>Correo:</strong> ${inv.email}</p>
<p><strong>Teléfono:</strong> ${inv.phone}</p>
${inv.address?`<p><strong>Dirección:</strong> ${inv.address}</p>`:""}
</div>
${order?`<div class="section"><h3>Detalle de servicios</h3>
<table class="table"><tr><th>Descripción</th><th>Monto</th></tr>
${svcLines.map(l=>`<tr><td>${l.split(":")[0]}</td><td>${l.split(":")[1]}</td></tr>`).join("")}
${order.parts?.map(p=>`<tr><td>${p.name} × ${p.qty}</td><td>${fmtCRC(p.price*p.qty)}</td></tr>`).join("")||""}
</table>
<div class="total">Total: ${fmtCRC(order.total)}</div></div>`:""}
${inv.notes?`<div class="section"><h3>Notas</h3><p>${inv.notes}</p></div>`:""}
<div class="footer">Tecno AutoAsisten CR · Costa Rica · tecno-autoasisten.vercel.app<br>
<em>Este documento es una representación de factura electrónica.</em></div>
</body></html>`;

    const blob = new Blob([html], { type:"text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `Factura-${inv.legalName.replace(/\s+/g,"-")}-${inv.id?.slice(0,6)}.html`;
    a.click(); URL.revokeObjectURL(url);
  };

  const counts = { pending:invoices.filter(i=>i.status==="pending").length, processing:invoices.filter(i=>i.status==="processing").length, sent:invoices.filter(i=>i.status==="sent").length };

  return (
    <div>
      <div style={{ fontWeight:800, fontSize:22, marginBottom:6 }}>🧾 Facturas electrónicas</div>
      <div style={{ color:C.textMd, fontSize:14, marginBottom:20 }}>Solicitudes de factura de clientes. Descargá el PDF y enviáselo por correo o WhatsApp.</div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:20 }}>
        {[["pending","Pendientes",C.amber],["processing","En proceso",C.blueHi],["sent","Enviadas",C.green]].map(([k,l,color])=>(
          <div key={k} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 18px" }}>
            <div style={{ fontSize:11, color:C.textSm, textTransform:"uppercase", letterSpacing:.7 }}>{l}</div>
            <div style={{ fontSize:26, fontWeight:800, color, marginTop:5 }}>{counts[k]||0}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[["all","Todas"],["pending","Pendientes"],["processing","En proceso"],["sent","Enviadas"],["cancelled","Canceladas"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${filter===v?C.blueHi:C.border}`, background:filter===v?`${C.blue}22`:"transparent", color:filter===v?C.blueHi:C.textMd, cursor:"pointer", fontSize:13, fontWeight:filter===v?700:400 }}>{l}</button>
        ))}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {sorted.map(inv=>{
          const client = data.clients.find(c=>c.id===inv.clientId);
          const order  = inv.orderId ? data.orders.find(o=>o.id===inv.orderId) : null;
          const sc = STATUS_INV[inv.status]||STATUS_INV.pending;
          return (
            <div key={inv.id} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"18px 20px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ fontWeight:700, fontSize:15 }}>{inv.legalName}</div>
                  <div style={{ fontSize:12, color:C.textSm, marginTop:3 }}>🪪 {inv.idNum} · 👤 {client?.name||"—"}</div>
                  <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>✉️ {inv.email} · 📱 {inv.phone}</div>
                  {inv.address && <div style={{ fontSize:12, color:C.textSm, marginTop:2 }}>📍 {inv.address}</div>}
                  {order && <div style={{ fontSize:12, color:C.green, marginTop:4, fontWeight:600 }}>Orden: {fmtDate(order.date)} · {fmtCRC(order.total)}</div>}
                  {inv.notes && <div style={{ fontSize:12, color:C.textSm, marginTop:4 }}>💬 {inv.notes}</div>}
                  <div style={{ fontSize:11, color:C.textSm, marginTop:4 }}>Solicitada: {fmtDate(inv.createdAt?.slice(0,10))}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end" }}>
                  <Pill label={sc.label} color={sc.color} bg={sc.bg} />
                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", justifyContent:"flex-end" }}>
                    {inv.status==="pending" && <TBtn label="▶ En proceso" color={C.blueHi} onClick={()=>upd(inv.id,{status:"processing"})} />}
                    <button onClick={()=>buildPDF(inv)} style={{ padding:"6px 12px", borderRadius:7, border:`1px solid ${C.purple}44`, background:`${C.purple}18`, color:C.purple, fontWeight:700, fontSize:12, cursor:"pointer" }}>
                      📄 Generar PDF
                    </button>
                    {inv.status!=="sent" && inv.status!=="cancelled" && <TBtn label="✅ Marcar enviada" color={C.green} onClick={()=>upd(inv.id,{status:"sent"})} />}
                    <IBtn icon="🗑" red onClick={()=>setDelId(inv.id)} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {sorted.length===0 && <Empty msg="No hay solicitudes de factura" />}
      </div>

      {delId && <Confirm msg="¿Eliminar esta solicitud?" onOk={()=>del(delId)} onCancel={()=>setDelId(null)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SETTINGS PAGE — Configuración del sistema
═══════════════════════════════════════════════════ */
function SettingsPage() {
  const [cfg, setCfg] = useState(getSettings());
  const [saved, setSaved] = useState(false);

  const set = (k,v) => setCfg(p=>({...p,[k]:v}));

  const save = () => {
    saveSettings(cfg);
    setSaved(true);
    setTimeout(()=>setSaved(false), 2500);
    // Update schedule globals
    SCHEDULE.weekday  = { start:cfg.schedWeekdayStart, end:cfg.schedWeekdayEnd };
    SCHEDULE.saturday = { start:cfg.schedSatStart,     end:cfg.schedSatEnd     };
  };

  const ALL_NAV = NAV.filter(n=>n.id!=="dashboard");
  const hiddenSet = new Set(cfg.hiddenNav||[]);
  const toggleNav = (id) => {
    const next = hiddenSet.has(id) ? [...hiddenSet].filter(x=>x!==id) : [...hiddenSet, id];
    set("hiddenNav", next);
  };

  const hours = Array.from({length:24},(_,i)=>i);

  return (
    <div style={{ maxWidth:720, margin:"0 auto" }}>
      <div style={{ fontWeight:800, fontSize:22, marginBottom:6 }}>⚙️ Configuración del sistema</div>
      <div style={{ color:C.textMd, fontSize:14, marginBottom:28 }}>Ajustá la moneda, horario, metas y más desde aquí.</div>

      {saved && (
        <div style={{ background:`${C.green}18`, border:`1px solid ${C.green}44`, borderRadius:10, padding:"12px 18px", marginBottom:20, color:C.green, fontWeight:600 }}>
          ✅ Configuración guardada correctamente.
        </div>
      )}

      {/* MONEDA */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"22px 24px", marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:16 }}>💱 Moneda del sistema</div>
        <div style={{ display:"flex", gap:10 }}>
          {[["CRC","₡ Colones (CRC)"],["USD","$ Dólares (USD)"]].map(([v,l])=>(
            <button key={v} onClick={()=>set("currency",v)} style={{ flex:1, padding:"12px", borderRadius:10, border:`1px solid ${cfg.currency===v?C.blueHi:C.border}`, background:cfg.currency===v?`${C.blue}22`:"transparent", color:cfg.currency===v?C.blueHi:C.textMd, fontWeight:cfg.currency===v?700:400, cursor:"pointer", fontSize:14 }}>{l}</button>
          ))}
        </div>
        {cfg.currency==="USD" && <div style={{ marginTop:10, fontSize:12, color:C.textSm }}>💡 El sistema usa ₡530 como tipo de cambio estimado para mostrar en dólares.</div>}
      </div>

      {/* META MENSUAL */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"22px 24px", marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:16 }}>🎯 Meta de utilidad mensual</div>
        <div>
          <label style={{ fontSize:12, fontWeight:600, color:C.textSm, display:"block", marginBottom:6 }}>Meta en {cfg.currency==="USD"?"dólares (USD)":"colones (₡)"}</label>
          <input type="number" value={cfg.monthlyGoal} onChange={e=>set("monthlyGoal",+e.target.value)} style={{...IS(), maxWidth:300}} placeholder="500000" />
          <div style={{ fontSize:12, color:C.textSm, marginTop:6 }}>Aparece como barra de progreso en el panel de inicio.</div>
        </div>
      </div>

      {/* HORARIO */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"22px 24px", marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:16 }}>🕐 Horario de atención (portal clientes)</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:C.textSm, marginBottom:10 }}>Lunes a Viernes</div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C.textSm, display:"block", marginBottom:4 }}>Desde</label>
                <select value={cfg.schedWeekdayStart} onChange={e=>set("schedWeekdayStart",+e.target.value)} style={IS()}>
                  {hours.map(h=><option key={h} value={h}>{h}:00</option>)}
                </select>
              </div>
              <span style={{ color:C.textSm, marginTop:16 }}>–</span>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C.textSm, display:"block", marginBottom:4 }}>Hasta</label>
                <select value={cfg.schedWeekdayEnd} onChange={e=>set("schedWeekdayEnd",+e.target.value)} style={IS()}>
                  {hours.map(h=><option key={h} value={h}>{h}:00</option>)}
                </select>
              </div>
            </div>
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color:C.textSm, marginBottom:10 }}>Sábado</div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C.textSm, display:"block", marginBottom:4 }}>Desde</label>
                <select value={cfg.schedSatStart} onChange={e=>set("schedSatStart",+e.target.value)} style={IS()}>
                  {hours.map(h=><option key={h} value={h}>{h}:00</option>)}
                </select>
              </div>
              <span style={{ color:C.textSm, marginTop:16 }}>–</span>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:11, color:C.textSm, display:"block", marginBottom:4 }}>Hasta</label>
                <select value={cfg.schedSatEnd} onChange={e=>set("schedSatEnd",+e.target.value)} style={IS()}>
                  {hours.map(h=><option key={h} value={h}>{h}:00</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:16 }}>
          <input type="checkbox" checked={cfg.schedSunOpen||false} onChange={e=>set("schedSunOpen",e.target.checked)} style={{ width:16, height:16, cursor:"pointer", accentColor:C.blueHi }} />
          <label style={{ fontSize:13, color:C.textMd, cursor:"pointer" }}>Abrir los domingos</label>
        </div>
      </div>

      {/* CARGAS SOCIALES Y PLANILLA */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"22px 24px", marginBottom:16 }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:16 }}>👥 Cargas sociales y planilla</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <div>
            <label style={{ fontSize:12, fontWeight:600, color:C.textSm, display:"block", marginBottom:6 }}>% Cargas sociales (CCSS)</label>
            <input type="number" value={cfg.socialCharges} onChange={e=>set("socialCharges",+e.target.value)} style={IS()} step="0.01" />
            <div style={{ fontSize:11, color:C.textSm, marginTop:4 }}>Costa Rica: 26.67% patronal</div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", justifyContent:"center" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <input type="checkbox" checked={cfg.payrollEnabled||false} onChange={e=>set("payrollEnabled",e.target.checked)} style={{ width:16, height:16, cursor:"pointer", accentColor:C.blueHi }} />
              <label style={{ fontSize:13, color:C.textMd, cursor:"pointer" }}>Activar módulo de planilla</label>
            </div>
            <div style={{ fontSize:11, color:C.textSm, marginTop:6 }}>Permite registrar salarios y calcular cargas automáticamente.</div>
          </div>
        </div>
      </div>

      {/* MENÚ LATERAL */}
      <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"22px 24px", marginBottom:24 }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:6 }}>📋 Personalizar menú lateral</div>
        <div style={{ fontSize:13, color:C.textMd, marginBottom:16 }}>Marcá los módulos que querés ocultar del menú. El inicio siempre es visible.</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {ALL_NAV.map(n=>{
            const hidden = hiddenSet.has(n.id);
            return (
              <div key={n.id} onClick={()=>toggleNav(n.id)} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderRadius:8, border:`1px solid ${hidden?C.border:C.blueHi}`, background:hidden?C.bg:`${C.blue}11`, cursor:"pointer" }}>
                <span style={{ fontSize:16, opacity:hidden?.4:1 }}>{n.icon}</span>
                <span style={{ fontSize:13, fontWeight:600, color:hidden?C.textSm:C.text, textDecoration:hidden?"line-through":"none" }}>{n.label}</span>
                <span style={{ marginLeft:"auto", fontSize:11, color:hidden?C.textSm:C.blueHi }}>{hidden?"Oculto":"Visible"}</span>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={save} style={{ width:"100%", padding:"14px", borderRadius:12, border:"none", background:`linear-gradient(135deg,${C.blue},${C.cyan})`, color:"#fff", fontWeight:700, fontSize:16, cursor:"pointer" }}>
        💾 Guardar configuración
      </button>
    </div>
  );
}
