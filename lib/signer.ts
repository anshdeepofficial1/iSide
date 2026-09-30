export function signer(){
 const base=process.env.ISIDE_SIGNING_API_URL?.replace(/\/$/,"");
 const token=process.env.ISIDE_SIGNING_API_TOKEN;
 if(!base||!token)return null;
 return {base,headers:{"content-type":"application/json","authorization":"Bearer "+token}};
}
export async function proxyJson(url:string,init:RequestInit){
 const r=await fetch(url,{...init,cache:"no-store"});
 const text=await r.text();let data:any;try{data=JSON.parse(text)}catch{data={error:text||"Signing service returned an invalid response."}}
 return {r,data};
}