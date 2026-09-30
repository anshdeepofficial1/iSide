import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name:"iSide Manager", short_name:"iSide", description:"Install, track and manage iOS apps.", start_url:"/manager", display:"standalone", background_color:"#050b14", theme_color:"#07111f", icons:[{src:"/icon.svg",sizes:"any",type:"image/svg+xml",purpose:"any maskable"}] };
}
