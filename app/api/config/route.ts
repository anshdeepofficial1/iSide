export const dynamic="force-dynamic";
export async function GET(){
 return Response.json({
  signingConfigured:Boolean(process.env.ISIDE_SIGNING_API_URL&&process.env.ISIDE_SIGNING_API_TOKEN),
  siteUrl:process.env.NEXT_PUBLIC_SITE_URL||null
 });
}