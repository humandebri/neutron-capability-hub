import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { connectionStatus, listJobs, listPolicies, runGitHubDemo, saveConnection, savePolicy as saveGitHubPolicy } from "./modules/github/backend.ts";
import { completeTask, createTask, listTasks } from "./modules/tasks/api.ts";
import { createOrder, listMenus, loadConfig, saveConfig } from "./modules/cycles/api.ts";
import { emptyModel, type Section, type TrustConsoleActions, type TrustConsoleModel } from "./model.ts";
import { TrustConsoleView } from "./view.tsx";
import "./style.scss";

function selectedSection(): Section { const value = location.hash.replace(/^#\/?/, "") as Section; return ["overview","github","tasks","cyclemint"].includes(value) ? value : "overview"; }
function App(){
  const [model,setModel]=useState<TrustConsoleModel>(emptyModel); const [section,setSection]=useState<Section>(selectedSection()); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const refresh=useCallback(async()=>{const results=await Promise.allSettled([connectionStatus(),listPolicies(),listJobs(),listTasks(),loadConfig()]);setModel(current=>({ ...current,
    connection:results[0].status==="fulfilled"?results[0].value:current.connection, policies:results[1].status==="fulfilled"?results[1].value.policies:current.policies,
    jobs:results[2].status==="fulfilled"?results[2].value.jobs:current.jobs, tasks:results[3].status==="fulfilled"?results[3].value.tasks:current.tasks,
    cycles:results[4].status==="fulfilled"?results[4].value:current.cycles,
  })); const rejected=results.find((result)=>result.status==="rejected"); setError(rejected&&rejected.status==="rejected"?message(rejected.reason):"");},[]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer)},[refresh]);
  async function run(operation:()=>Promise<void>){setBusy(true);setError("");try{await operation();await refresh()}catch(reason){setError(message(reason))}finally{setBusy(false)}}
  const actions=useMemo<TrustConsoleActions>(()=>({
    navigate(next){location.hash=next;setSection(next)},
    async connectGitHub(token,label){await run(async()=>{await saveConnection(token,label)})},
    async saveGitHubPolicy(consumer,owner,repo){await run(async()=>{await saveGitHubPolicy({consumerAppId:consumer,owner,repo,allowIssueRead:true,allowIssueCreate:true,enabled:true,revision:"0"})})},
    async createTask(title){await run(async()=>{await createTask({title,clientRequestId:crypto.randomUUID()})})}, async completeTask(id,revision){await run(async()=>{await completeTask(id,revision)})},
    async configureCycleMint(service,url){await run(async()=>{await saveConfig(service,url)})}, async refreshMenus(){await run(async()=>{const menus=await listMenus();setModel(current=>({...current,menus}))})},
    async createCycleOrder(menuId){await run(async()=>{const order=await createOrder(menuId,crypto.randomUUID());setModel(current=>({...current,order}));if(order.clientSecret&&model.cycles.hostedCheckoutUrl){const base=model.cycles.hostedCheckoutUrl.replace(/\/$/,"");const target=`${base}/neutron-checkout.html#client_secret=${encodeURIComponent(order.clientSecret)}&order_id=${encodeURIComponent(order.orderId)}`;window.open(target,"_blank","noopener,noreferrer")}})},
    async runGitHubDemo(){await run(async()=>{await runGitHubDemo(crypto.randomUUID())})},
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }),[model.cycles.hostedCheckoutUrl,refresh]);
  return <TrustConsoleView model={model} section={section} actions={actions} busy={busy} error={error}/>;
}
function message(reason:unknown){return reason instanceof Error?reason.message:String(reason)}
const root=document.getElementById("root");if(!root)throw new Error("Root element not found");createRoot(root).render(<App/>);
