import { proxyJson, signer } from "@/lib/signer";
export const runtime="nodejs";
export async function POST(req:Request){
 const s=signer();if(!s)return Response.json({error:"Signing service is not configured."},{status:503});
 const body=await req.json();
 const {r,data}=await proxyJson(s.base+"/v1/signing/session",{method:"POST",headers:s.headers,body:JSON.stringify(body)});
 return Response.json(data,{status:r.status});
}