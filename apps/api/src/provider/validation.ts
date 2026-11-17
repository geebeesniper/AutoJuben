import { isIP } from 'node:net';
import { config } from '../config.js';
import { assert } from '../utils/errors.js';
export type MediaKind = 'image'|'audio'|'video';
export type VideoInput = {
  projectId?:string|null;
  clientTaskId?:string|null;
  prompt:string;model:string;duration:number;ratio:string;resolution:string;
  imageUrls?:string[];audioUrls?:string[];videoUrls?:string[];
  imageAssetIds?:string[];audioAssetIds?:string[];videoAssetIds?:string[];
};
export function validatePublicUrl(input:string,allowHttp=config.allowHttpMedia):string {
  assert(typeof input==='string'&&input.length<=2048,'素材链接长度不能超过 2048');
  let url:URL;
  try { url=new URL(input); }catch{throw new Error('素材 URL 格式不正确');}
  assert(url.protocol==='https:' || (allowHttp && url.protocol==='http:'),'素材必须是 HTTPS 公网 URL');
  assert(!url.username&&!url.password,'素材 URL 不得包含账户信息');
  const host=url.hostname.toLowerCase().replace(/^\[|\]$/g,'');
  assert(!!host && host!=='localhost' && !host.endsWith('.localhost') && !host.endsWith('.local') && !host.endsWith('.internal') && host!=='metadata.google.internal','不支持本地或内网 URL');
  const ip=isIP(host);
  if(ip===4) {
    const [a,b]=host.split('.').map(Number);
    assert(!(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127)||(a===192&&b===0)),'不支持内网 IP');
  }
  if(ip===6) assert(!/^(::|::1$|f[cd]|fe[89ab]|::ffff:)/i.test(host),'不支持本地或私有 IPv6');
  return url.toString();
}
function strings(list:unknown,max:number,label:string):string[] {
  assert(Array.isArray(list),`${label} 必须是数组`);
  assert(list.length<=max,`${label} 最多 ${max} 个`);
  return list.map(x=>{assert(typeof x==='string',`${label} 格式错误`);return x;});
}
export function validateVideoInput(data:VideoInput):Required<Omit<VideoInput,'projectId'|'clientTaskId'>> & Pick<VideoInput,'projectId'|'clientTaskId'> {
  assert(data && typeof data.prompt==='string' && data.prompt.trim().length>=5 && data.prompt.length<=5000,'提示词需要 5–5000 字符');
  // Provider models are discovered via /api/public-settings, not permanently hard-coded here.
  // Validate an opaque safe model identifier; upstream activation and optional tariff checks are independent.
  assert(typeof data.model==='string' && /^[a-z0-9][a-z0-9._-]{1,79}$/i.test(data.model),'视频模型 ID 格式无效');
  assert(Number.isInteger(data.duration) && data.duration>=4&&data.duration<=15,'时长必须是 4–15 秒');
  assert(['9:16','16:9'].includes(data.ratio),'比例必须是 9:16 或 16:9');
  assert(data.model==='xinghe-fast' ? data.resolution==='480p' : ['480p','720p','1080p','4k'].includes(data.resolution),'模型不支持该分辨率');
  const imageUrls=strings(data.imageUrls??[],9,'图片').map(x=>validatePublicUrl(x));
  const audioUrls=strings(data.audioUrls??[],3,'音频').map(x=>validatePublicUrl(x));
  const videoUrls=strings(data.videoUrls??[],3,'视频').map(x=>validatePublicUrl(x));
  const imageAssetIds=strings(data.imageAssetIds??[],9,'图片上传 ID');
  const audioAssetIds=strings(data.audioAssetIds??[],3,'音频上传 ID');
  const videoAssetIds=strings(data.videoAssetIds??[],3,'视频上传 ID');
  assert(imageUrls.length+imageAssetIds.length<=9,'图片总数不能超过 9 张');
  assert(audioUrls.length+audioAssetIds.length<=3,'音频总数不能超过 3 条');
  assert(videoUrls.length+videoAssetIds.length<=3,'视频总数不能超过 3 条');
  assert(imageUrls.length+imageAssetIds.length+audioUrls.length+audioAssetIds.length+videoUrls.length+videoAssetIds.length<=12,'全部素材合计最多 12 个');
  assert(!data.clientTaskId || (data.clientTaskId.length>=3 && data.clientTaskId.length<=120),'幂等 ID 长度需要 3–120');
  return {...data,prompt:data.prompt.trim(),imageUrls,audioUrls,videoUrls,imageAssetIds,audioAssetIds,videoAssetIds};
}
