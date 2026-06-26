import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const OUT = "/Users/dexter/Documents/SSA-态势感知/outputs/火星先锋_初一课程大纲.pptx";
const PREVIEW_DIR = "/Users/dexter/Documents/SSA-态势感知/outputs/火星先锋_预览";
const ASSET = "/Users/dexter/Downloads/Claude工作/新课程研发";

const W = 1280, H = 720;
const C = { bg:"#070B13", panel:"#0E1724", panel2:"#111C2B", line:"#1D3446", cyan:"#00D5FF", orange:"#FF5A1F", green:"#2ED66F", text:"#EEF6FF", sub:"#9FB2C5", muted:"#647487" };

async function img(name) { return new Uint8Array(await fs.readFile(path.join(ASSET, name))); }
function addShape(slide, geometry, position, fill = "none", line = { style:"solid", fill:"none", width:0 }) { return slide.shapes.add({ geometry, position, fill, line }); }
function text(slide, value, position, style = {}) {
  const s = addShape(slide, "textbox", position);
  s.text = value;
  s.text.style = { fontSize: style.fontSize ?? 22, bold: style.bold ?? false, color: style.color ?? C.text, alignment: style.alignment ?? "left", ...style };
  return s;
}
function title(slide, t, sub = "") {
  text(slide, "MARS PIONEER | 初一航天机器人课程", { left:64, top:38, width:620, height:28 }, { fontSize:16, bold:true, color:C.cyan });
  text(slide, t, { left:64, top:78, width:790, height:56 }, { fontSize:40, bold:true, color:C.text });
  if (sub) text(slide, sub, { left:66, top:136, width:850, height:34 }, { fontSize:20, color:C.sub });
  addShape(slide, "line", { left:64, top:180, width:1152, height:0 }, "none", { style:"solid", fill:C.line, width:1.2 });
}
function footer(slide, n) { text(slide, `火星先锋课程大纲 · ${String(n).padStart(2,"0")}`, { left:1030, top:674, width:190, height:24 }, { fontSize:13, color:C.muted, alignment:"right" }); }
function card(slide, x, y, w, h, head, body, accent = C.cyan) {
  const box = addShape(slide, "roundRect", { left:x, top:y, width:w, height:h }, C.panel, { style:"solid", fill:C.line, width:1 }); box.borderRadius = 10;
  addShape(slide, "rect", { left:x, top:y, width:5, height:h }, accent, { style:"solid", fill:accent, width:0 });
  text(slide, head, { left:x+22, top:y+18, width:w-40, height:30 }, { fontSize:23, bold:true, color:C.text });
  text(slide, body, { left:x+22, top:y+58, width:w-40, height:h-72 }, { fontSize:17, color:C.sub });
}
function lessonRow(slide, y, code, name, focus, output, color) {
  text(slide, code, { left:86, top:y, width:64, height:28 }, { fontSize:18, bold:true, color });
  text(slide, name, { left:160, top:y, width:270, height:28 }, { fontSize:19, bold:true, color:C.text });
  text(slide, focus, { left:450, top:y, width:405, height:28 }, { fontSize:16, color:C.sub });
  text(slide, output, { left:875, top:y, width:315, height:28 }, { fontSize:16, color:C.sub });
  addShape(slide, "line", { left:78, top:y+36, width:1120, height:0 }, "none", { style:"solid", fill:"#162635", width:1 });
}
function lessonMini(slide, y, code, name, focus, output, color) {
  text(slide, code, { left:86, top:y, width:62, height:28 }, { fontSize:18, bold:true, color });
  text(slide, name, { left:162, top:y, width:222, height:28 }, { fontSize:19, bold:true, color:C.text });
  text(slide, focus, { left:392, top:y, width:274, height:28 }, { fontSize:16, color:C.sub });
  text(slide, output, { left:162, top:y+28, width:500, height:24 }, { fontSize:15, color:color });
  addShape(slide, "line", { left:78, top:y+62, width:592, height:0 }, "none", { style:"solid", fill:"#162635", width:1 });
}

const p = Presentation.create({ slideSize:{ width:W, height:H } });
const hero = await img("火星先锋_产品效果图.png");
const render3d = await img("火星先锋_3D渲染.png");
const three = await img("火星先锋_工程三视图.png");
const circuit = await img("火星先锋_电路布局图.png");
const iso = await img("火星先锋_等轴测渲染图.png");
const exploded = await img("火星先锋_零件爆炸图.png");

{ const s=p.slides.add(); s.background.fill=C.bg; s.images.add({ blob:hero, contentType:"image/png", alt:"火星先锋产品效果图", fit:"cover", position:{ left:0, top:0, width:W, height:H } }); addShape(s,"rect",{ left:0, top:0, width:575, height:H },"#050911CC",{ style:"solid", fill:"none", width:0 }); text(s,"火星先锋",{ left:72, top:145, width:470, height:74 },{ fontSize:58, bold:true, color:C.text }); text(s,"Mars Pioneer",{ left:76, top:222, width:360, height:42 },{ fontSize:34, color:C.cyan }); text(s,"面向初一学生的嵌入式编程与仿生火星探测机器人课程大纲",{ left:76, top:300, width:430, height:92 },{ fontSize:24, color:C.sub }); text(s,"15课时 · STM32 · 麦克纳姆轮 · 机械臂 · 传感器 · 模拟赛事",{ left:76, top:612, width:710, height:30 },{ fontSize:18, color:C.text }); }
{ const s=p.slides.add(); s.background.fill=C.bg; title(s,"课程定位","把“火星探测任务”拆成初一学生能完成的工程挑战"); footer(s,2); card(s,72,224,250,160,"对象","初一年级学生\n有图形化/基础编程经验更佳\n以小组协作为主要学习方式",C.cyan); card(s,354,224,250,160,"课时","共15节课\n每节60分钟\n14节核心学习 + 1节模拟赛事/展示",C.green); card(s,636,224,250,160,"平台","STM32主控\n全向底盘\n机械臂与多传感器系统",C.orange); card(s,918,224,250,160,"产出","能跑、能看、能抓、能判断\n完成一次火星任务式综合演示",C.cyan); text(s,"课程主线：认识硬件 → 控制运动 → 感知环境 → 完成任务 → 复盘表达",{ left:118, top:460, width:1040, height:44 },{ fontSize:28, bold:true, color:C.text, alignment:"center" }); }
{ const s=p.slides.add(); s.background.fill=C.bg; title(s,"初一适配原则","保留真实工程味道，但降低数学和代码门槛"); footer(s,3); s.images.add({ blob:render3d, contentType:"image/png", alt:"火星先锋3D渲染图", fit:"cover", position:{ left:710, top:126, width:510, height:430 }, geometry:"roundRect", borderRadius:12 }); card(s,72,220,560,86,"先任务，后公式","先让小车前进、横移、转向，再回头解释轮子为什么这样转。",C.cyan); card(s,72,324,560,86,"先调用，再理解","先用 SpaceCommon 库完成基本控制，再逐步拆开 GPIO、PWM、IIC、SPI。",C.green); card(s,72,428,560,86,"先现象，后调参","巡线、机械臂、避障都用可观察现象引入，通过测试记录理解参数。",C.orange); }
{ const s=p.slides.add(); s.background.fill=C.bg; title(s,"硬件平台概览","三层架构支撑从单模块到系统集成的学习路径"); footer(s,4); s.images.add({ blob:exploded, contentType:"image/png", alt:"零件爆炸图", fit:"cover", position:{ left:648, top:132, width:542, height:442 }, geometry:"roundRect", borderRadius:12 }); card(s,78,222,484,84,"上层：控制与交互","STM32主控、蓝牙通信、PS手柄、OLED显示、RGB状态灯",C.cyan); card(s,78,326,484,84,"中层：环境与运动感知","8路红外巡线、超声波、光亮、温湿度等传感器",C.green); card(s,78,430,484,84,"底层：执行与供电","四轮独立电机、麦克纳姆轮、机械臂舵机、双路供电",C.orange); }
{ const s=p.slides.add(); s.background.fill=C.bg; title(s,"课程能力地图","五个阶段从“会操作”走向“会设计、会解释”"); footer(s,5); const xs=[82,306,530,754,978], heads=["基础夯实","遥操作控制","环境感知","综合实战","模拟赛事"], bodies=["L01-L03\n开发环境、结构认知、全向移动","L04-L06\n蓝牙遥控、机械臂、采样协同","L07-L09\n环境监控、巡线、状态机切换","L10-L13\n能源抢夺、越野、运输、Debug","L14-L15\n计时赛、工程日志、路演答辩"], colors=[C.cyan,C.green,C.orange,C.cyan,C.green]; xs.forEach((x,i)=>{ addShape(s,"ellipse",{ left:x+62, top:236, width:84, height:84 },colors[i],{ style:"solid", fill:colors[i], width:0 }); text(s,String(i+1),{ left:x+80, top:250, width:48, height:48 },{ fontSize:36, bold:true, color:C.bg, alignment:"center" }); if(i<4) addShape(s,"line",{ left:x+156, top:278, width:122, height:0 },"none",{ style:"solid", fill:"#2A455A", width:3 }); card(s,x,354,196,150,heads[i],bodies[i],colors[i]); }); }
{ const s=p.slides.add(); s.background.fill=C.bg; title(s,"第一章：基础夯实","硬件认知与运动学入门"); footer(s,6); s.images.add({ blob:three, contentType:"image/png", alt:"工程三视图", fit:"cover", position:{ left:730, top:130, width:490, height:420 }, geometry:"roundRect", borderRadius:12 }); lessonMini(s,224,"L01","航天史与开发环境","认识太空车与STM32","作品：完成第一个可运行工程",C.cyan); lessonMini(s,304,"L02","结构与数据显控","IIC与OLED显示","作品：做出“火星仪表盘”",C.cyan); lessonMini(s,384,"L03","麦克纳姆轮全向移动","四轮方向组合与PWM","作品：小车走正方形并回到起点",C.cyan); text(s,"初一处理方式：用“轮子方向表”和实测现象代替复杂矩阵推导。",{ left:86, top:502, width:580, height:52 },{ fontSize:21, color:C.orange, bold:true }); }
{ const s=p.slides.add(); s.background.fill=C.bg; title(s,"第二章：遥操作与执行","从手柄控制到机械臂采样任务"); footer(s,7); s.images.add({ blob:iso, contentType:"image/png", alt:"等轴测渲染图", fit:"cover", position:{ left:694, top:126, width:524, height:436 }, geometry:"roundRect", borderRadius:12 }); lessonMini(s,224,"L04","蓝牙通讯与底盘遥控","手柄数据映射到轮速","作品：实现底盘遥控",C.green); lessonMini(s,304,"L05","机械臂抓取","舵机角度与预设姿态","作品：完成连续抓放任务",C.green); lessonMini(s,384,"L06","采样空间协同","底盘粗定位+机械臂精抓取","作品：完成月壤采样流程",C.green); text(s,"关键问题：信号中断、小车震动、机械臂多解，都是工程系统必须处理的真实问题。",{ left:86, top:502, width:560, height:54 },{ fontSize:20, color:C.sub }); }
{ const s=p.slides.add(); s.background.fill=C.bg; title(s,"第三章：环境感知","自动驾驶入门：让机器人看见、判断、切换模式"); footer(s,8); s.images.add({ blob:circuit, contentType:"image/png", alt:"电路布局图", fit:"cover", position:{ left:680, top:122, width:540, height:450 }, geometry:"roundRect", borderRadius:12 }); lessonMini(s,224,"L07","环境监控预警","温湿度、光照、多级报警","作品：环境监控面板",C.orange); lessonMini(s,304,"L08","颜色识别与巡线","红外/颜色传感器+基础PID","作品：稳定通过弯道赛道",C.orange); lessonMini(s,384,"L09","复杂路况与切换","有限状态机与路标识别","作品：实现人机热切换",C.orange); text(s,"初一处理方式：PID只讲“偏得越多，纠得越多；变化越快，提前刹一刹”。",{ left:86, top:502, width:548, height:52 },{ fontSize:20, bold:true, color:C.orange }); }
{ const s=p.slides.add(); s.background.fill=C.bg; title(s,"第四章：综合实战","把底盘、机械臂、传感器和策略合成完整任务"); footer(s,9); card(s,76,224,250,190,"L10 能源抢夺战","自动导航到能源区\n手动抢夺与装载\n记录任务耗时",C.cyan); card(s,356,224,250,190,"L11 陨石坑越野","调节PWM功率\n设计脱困策略\n测试崎岖路况",C.green); card(s,636,224,250,190,"L12 基地运输","起点装载\n循迹行驶\n定点投放与返航",C.orange); card(s,916,224,250,190,"L13 故障排查","断线、参数、逻辑故障\n用日志和二分法定位\n完成故障报告",C.cyan); text(s,"这一章的目标不是“程序一次写对”，而是让学生经历真实工程的测试、失败、修复、再测试。",{ left:128, top:494, width:1030, height:50 },{ fontSize:25, bold:true, color:C.text, alignment:"center" }); }
{ const s=p.slides.add(); s.background.fill=C.bg; title(s,"第五章：模拟赛事与表达","从会做任务，走向会展示方案、解释数据"); footer(s,10); card(s,108,232,450,210,"L14 全真模拟计时赛","对标航天主题赛事规则\n完成赛前检查、3分钟计时任务、裁判评分\n赛后用录像复盘失误点",C.orange); card(s,710,232,450,210,"L15 工程日志与路演答辩","整理学习记录和实验数据\n制作5分钟项目展示\n回答硬件、算法、风险相关问题",C.cyan); text(s,"最终成果：一台能执行任务的火星漫游车 + 一份能讲清楚设计逻辑的学生项目汇报。",{ left:140, top:512, width:1000, height:40 },{ fontSize:26, bold:true, color:C.text, alignment:"center" }); }
{ const s=p.slides.add(); s.background.fill=C.bg; title(s,"15节课总览","每节课都有明确的课堂作品和可观察结果"); footer(s,11); text(s,"课时",{ left:88, top:202, width:70, height:28 },{ fontSize:18, bold:true, color:C.cyan }); text(s,"课程主题",{ left:160, top:202, width:260, height:28 },{ fontSize:18, bold:true, color:C.cyan }); text(s,"核心学习",{ left:450, top:202, width:300, height:28 },{ fontSize:18, bold:true, color:C.cyan }); text(s,"课堂作品",{ left:875, top:202, width:260, height:28 },{ fontSize:18, bold:true, color:C.cyan }); [["L01","开发环境","LED、GPIO、工程创建","流水灯程序"],["L02","结构显控","IIC、OLED、模块识别","车载仪表盘"],["L03","全向移动","麦克纳姆轮、PWM","正方形路径"],["L04","遥控通信","蓝牙、手柄数据","底盘遥控"],["L05","机械臂","舵机、姿态库","连续抓放"],["L06","采样协同","底盘+机械臂时序","月壤采样"],["L07","环境监控","温湿度、光照、报警","环境面板"]].forEach((r,i)=>lessonRow(s,248+i*50,r[0],r[1],r[2],r[3],i<3?C.cyan:i<6?C.green:C.orange)); }
{ const s=p.slides.add(); s.background.fill=C.bg; title(s,"15节课总览（续）","从感知控制进入综合任务和赛事表达"); footer(s,12); text(s,"课时",{ left:88, top:202, width:70, height:28 },{ fontSize:18, bold:true, color:C.cyan }); text(s,"课程主题",{ left:160, top:202, width:260, height:28 },{ fontSize:18, bold:true, color:C.cyan }); text(s,"核心学习",{ left:450, top:202, width:300, height:28 },{ fontSize:18, bold:true, color:C.cyan }); text(s,"课堂作品",{ left:875, top:202, width:260, height:28 },{ fontSize:18, bold:true, color:C.cyan }); [["L08","识别巡线","颜色/红外、PID","稳定巡线车"],["L09","人机切换","状态机、路标识别","自动/手动切换"],["L10","能源抢夺","任务分解、路线策略","抢夺任务脚本"],["L11","陨石坑越野","功率分配、脱困","越野参数组"],["L12","基地运输","动作队列、容错","自动运输闭环"],["L13","系统Debug","日志、二分法、看门狗","故障报告"],["L14","模拟计时赛","规则、计时、评分","正式比赛成绩"],["L15","路演答辩","工程日志、数据展示","5分钟项目汇报"]].forEach((r,i)=>lessonRow(s,238+i*47,r[0],r[1],r[2],r[3],i<2?C.orange:i<6?C.cyan:C.green)); }
{ const s=p.slides.add(); s.background.fill=C.bg; title(s,"教学组织建议","让课堂更适合初一学生的节奏"); footer(s,13); card(s,86,220,330,230,"小组分工","建议3-4人一组\n驾驶员：操作与测试\n程序员：代码与调参\n工程师：接线与记录\n讲解员：整理汇报",C.cyan); card(s,474,220,330,230,"课堂节奏","10分钟情境导入\n15分钟知识拆解\n25分钟动手任务\n10分钟复盘展示",C.green); card(s,862,220,330,230,"安全与管理","上电前检查接线\n机械臂运动区不伸手\n锂电池规范充放电\n每节课保留工程日志",C.orange); text(s,"教师重点：不要只看“有没有跑起来”，更要看学生是否能解释为什么这样设计。",{ left:124, top:520, width:1020, height:42 },{ fontSize:25, bold:true, color:C.text, alignment:"center" }); }
{ const s=p.slides.add(); s.background.fill=C.bg; title(s,"评价方式","用过程性证据评价工程学习，而不只看最终比赛名次"); footer(s,14); [["硬件装调","模块识别、接线规范、上电自检","20%"],["程序实现","功能完整、代码结构、调试记录","30%"],["任务表现","巡线、抓取、运输、赛事得分","25%"],["工程表达","日志、数据、复盘、答辩表现","25%"]].forEach((it,i)=>{ const y=220+i*82; const b=addShape(s,"roundRect",{ left:116, top:y, width:1048, height:60 },C.panel2,{ style:"solid", fill:C.line, width:1 }); b.borderRadius=10; text(s,it[0],{ left:146, top:y+15, width:180, height:28 },{ fontSize:22, bold:true, color:C.text }); text(s,it[1],{ left:352, top:y+17, width:620, height:28 },{ fontSize:19, color:C.sub }); text(s,it[2],{ left:1054, top:y+15, width:70, height:28 },{ fontSize:22, bold:true, color:i%2?C.green:C.cyan, alignment:"right" }); }); }
{ const s=p.slides.add(); s.background.fill=C.bg; s.images.add({ blob:render3d, contentType:"image/png", alt:"火星先锋3D渲染结尾图", fit:"cover", position:{ left:0, top:0, width:W, height:H } }); addShape(s,"rect",{ left:0, top:0, width:W, height:H },"#050911AA",{ style:"solid", fill:"none", width:0 }); text(s,"课程最终画像",{ left:82, top:110, width:600, height:62 },{ fontSize:46, bold:true, color:C.text }); text(s,"学生不只是“拼好一辆车”，而是能用工程语言说明：它如何移动、如何感知、如何决策、如何完成一次火星任务。",{ left:86, top:210, width:710, height:112 },{ fontSize:28, color:C.text }); text(s,"建议交付：学生工程日志、任务演示视频、课堂代码包、5分钟项目路演PPT。",{ left:88, top:560, width:870, height:34 },{ fontSize:22, color:C.cyan }); }

await fs.mkdir(PREVIEW_DIR, { recursive:true });
for (const [index, slide] of p.slides.items.entries()) {
  const stem = `slide-${String(index + 1).padStart(2,"0")}`;
  await fs.writeFile(path.join(PREVIEW_DIR, `${stem}.png`), new Uint8Array(await (await p.export({ slide, format:"png", scale:1 })).arrayBuffer()));
  await fs.writeFile(path.join(PREVIEW_DIR, `${stem}.layout.json`), await (await slide.export({ format:"layout" })).text());
}
await fs.writeFile(path.join(PREVIEW_DIR, "montage.webp"), new Uint8Array(await (await p.export({ format:"webp", montage:true, scale:1 })).arrayBuffer()));
const pptx = await PresentationFile.exportPptx(p);
await pptx.save(OUT);
console.log(OUT);
