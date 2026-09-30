import { proxyJson, signer } from "@/lib/signer";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 const s=signer();if(!s)return Response.json({error:"Signing service is not configured."},{status:503});
 const id=new URL(req.url).searchParams.get("sessionId");if(!id)return Response.json({error:"sessionId is required."},{status:400});
 const {r,data}=await proxyJson(s.base+"/v1/signing/status?sessionId="+encodeURIComponent(id),{headers:{"authorization":"Bearer "+process.env.ISIDE_SIGNING_API_TOKEN}});
 return Response.json(data,{status:r.status});
}