declare module "plist" { const plist:{parse:(input:string)=>any}; export default plist; }
declare module "bplist-parser" { const parser:{parseBuffer:(input:any)=>any[]}; export default parser; }