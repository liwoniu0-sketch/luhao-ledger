/**
 * 高级财务系统 V7.1.0 - 核心优化版
 * 1. 【成员归类与算式支持】：
 *    - 固定分类：红章（爸）、坤如（妈），其他所有人一律归为【姨】；
 *    - 多人多笔支持：姨的金额自动生成算式（例如 6+3），日支/月支/总计自动求和计算；
 *    - 消费人备注：在备注中自动标注是谁消费的（如 "烨文6元，坤艳3元"），账目一目了然。
 * 2. 【彻底根治编辑卡死与防误触】：
 *    - 路由全面兼容 /lz, /lz/, /lz/*，彻底消除末尾斜杠导致的只读模式锁死；
 *    - 增加【🔓 解锁/恢复编辑】一键复位机制，彻底消除遮罩与手势死锁；
 *    - 移除阻碍移动端聚焦的 touch-action 限制，增加输入框充足点击热区与单元格自动聚焦；
 *    - 拦截后台 visibilitychange 破坏性数据覆盖，保护当前编辑态与 AI 识别。
 * 3. 【AI 文本本地防丢与断点恢复】：
 *    - AI 输入框实时 localStorage 本地自动保存，无论刷新还是意外关闭，文字 100% 自动还原；
 *    - 识别结果断点恢复：支持一键恢复未确认导入的识别账目，彻底告别重复识别；
 *    - 15 秒单次请求超时熔断，杜绝长等待死锁。
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 强力穿透缓存头矩阵（彻底阻止浏览器、CDN边缘节点与反向代理的一切静态缓存）
    const NO_CACHE_HEADERS = {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
      "CDN-Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
      "Surrogate-Control": "no-store",
      "Pragma": "no-cache",
      "Expires": "0"
    };

    // 路由：开启编辑管理模式 (Route: Path /lz, /lz/, /lz/*)
    const isEditMode = url.pathname === "/lz" || url.pathname === "/lz/" || url.pathname.startsWith("/lz/");
    if (isEditMode) {
      return new Response(generateHTML(true), { 
        headers: { 
          "Content-Type": "text/html;charset=UTF-8",
          ...NO_CACHE_HEADERS
        } 
      });
    }

    // 接口：获取账目数据 (Get Ledger Data)
    if (url.pathname === "/api/get-data") {
      const [data, saveTime] = await Promise.all([
        env.DB.get("FINANCE_V5_DATA"),
        env.DB.get("FINANCE_V5_TIME")
      ]);
      return new Response(data || "[]", { 
        headers: { 
          "Content-Type": "application/json",
          "X-Server-Time": saveTime || "0",
          ...NO_CACHE_HEADERS
        } 
      });
    }

    // 接口：保存账目数据 (Save Ledger Data)
    if (url.pathname === "/api/save" && request.method === "POST") {
      const auth = request.headers.get("Authorization");
      if (auth !== "auth_lz_mode") return new Response("Forbidden (禁止访问)", { status: 403, headers: NO_CACHE_HEADERS });
      const newData = await request.text();
      const nowTime = Date.now().toString();
      await Promise.all([
        env.DB.put("FINANCE_V5_DATA", newData),
        env.DB.put("FINANCE_V5_TIME", nowTime)
      ]);
      return new Response(JSON.stringify({ success: true, time: nowTime }), { 
        headers: { 
          "Content-Type": "application/json",
          ...NO_CACHE_HEADERS 
        } 
      });
    }

    // 接口：获取 AI 大模型全局配置 (Get AI Config from Cloudflare KV)
    if (url.pathname === "/api/get-ai-config") {
      const config = await env.DB.get("FINANCE_AI_CONFIG");
      return new Response(config || "{}", { 
        headers: { 
          "Content-Type": "application/json",
          ...NO_CACHE_HEADERS
        } 
      });
    }

    // 接口：保存 AI 大模型全局配置 (Save AI Config to Cloudflare KV)
    if (url.pathname === "/api/save-ai-config" && request.method === "POST") {
      const auth = request.headers.get("Authorization");
      if (auth !== "auth_lz_mode") return new Response("Forbidden (禁止访问)", { status: 403, headers: NO_CACHE_HEADERS });
      const newConfig = await request.text();
      await env.DB.put("FINANCE_AI_CONFIG", newConfig);
      return new Response(JSON.stringify({ success: true }), { 
        headers: { 
          "Content-Type": "application/json",
          ...NO_CACHE_HEADERS 
        } 
      });
    }

    // 默认展示只读页面
    return new Response(generateHTML(false), { 
      headers: { 
        "Content-Type": "text/html;charset=UTF-8",
        ...NO_CACHE_HEADERS
      } 
    });
  }
};

function generateHTML(enableEditMode) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>财务核算中心 v7.2.0 (网络穿透零缓存 + 防并发覆盖 + 多人算式)</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js"></script>
    <script src="https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js"></script>
    <style>
        [v-cloak] { display: none; }
        .data-input { 
            border-bottom: 1px solid transparent;
            outline: none;
            transition: all 0.15s ease-in-out;
            width: 100%;
            text-align: center;
            padding: 4px 2px;
            min-height: 28px;
            font-size: 13px !important;
            background: transparent;
        }
        .data-input:focus {
            border-bottom-color: #6366f1;
            background-color: rgba(238, 242, 255, 0.75);
        }
        .month-gradient { background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%); }
        .sync-indicator { position: fixed; bottom: 20px; right: 20px; padding: 6px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold; transition: all 0.2s; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-width: 1px; z-index: 40; }
        .month-hidden { opacity: 0.6; filter: grayscale(0.5); }
        .checkbox-custom { width: 1.25rem; height: 1.25rem; cursor: pointer; accent-color: #4f46e5; }
        .custom-scrollbar::-webkit-scrollbar { height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        th, td { min-width: 80px; }
        .date-col { min-width: 72px; }
        .note-col { min-width: 100px; max-width: 130px; }
    </style>
</head>
<body class="bg-gray-50 text-slate-800 font-sans antialiased">
    <div id="app" v-cloak class="max-w-[1600px] mx-auto p-3 md:p-8">
        
        <!-- 全端实时云同步与本地安全状态指示器 -->
        <div v-if="isLoggedIn" class="sync-indicator flex items-center gap-1.5" 
             :class="{
                'bg-emerald-100 text-emerald-700 border-emerald-300': syncStatus === 'synced',
                'bg-amber-100 text-amber-700 border-amber-300': syncStatus === 'saving',
                'bg-blue-100 text-blue-700 border-blue-300': syncStatus === 'pending',
                'bg-orange-100 text-orange-800 border-orange-300': syncStatus === 'offline_cached'
             }">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" 
                  :class="{
                    'bg-emerald-500': syncStatus === 'synced',
                    'bg-amber-500 animate-pulse': syncStatus === 'saving',
                    'bg-blue-500 animate-pulse': syncStatus === 'pending',
                    'bg-orange-500': syncStatus === 'offline_cached'
                  }"></span>
            <span class="text-[10px] md:text-xs">{{ syncStatusText }}</span>
        </div>

        <header class="mb-6 flex flex-col md:flex-row justify-between md:items-end gap-5">
            <div class="flex-1">
                <div class="flex items-center gap-2.5">
                    <h1 class="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">财务管理 <span class="text-indigo-600 text-sm">v7.2.0</span></h1>
                    <span v-if="isLoggedIn" class="bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        ✏️ 编辑模式
                    </span>
                    <a v-else href="/lz" class="bg-slate-200 hover:bg-indigo-100 text-slate-600 hover:text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors">
                        🔒 只读 (点击切换编辑)
                    </a>
                </div>
                <p class="text-slate-500 font-medium text-[10px] md:text-xs font-mono uppercase tracking-widest mt-1">
                    红章(爸) · 坤如(妈) · 姨(其他人算式多金额) / 防卡死防丢失 / 全自动云同步
                </p>
                
                <div class="grid grid-cols-2 lg:flex lg:flex-wrap gap-3 mt-4">
                    <div class="bg-white p-3 rounded-xl shadow-xs border border-slate-100">
                        <p class="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase text-center">总核算收入 (Income)</p>
                        <p class="text-lg md:text-xl font-black text-rose-500 text-center">¥ {{ totalStats.income.toFixed(2) }}</p>
                    </div>
                    <div class="bg-white p-3 rounded-xl shadow-xs border border-slate-100">
                        <p class="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase text-center">总核算支出 (Expense)</p>
                        <p class="text-lg md:text-xl font-black text-emerald-600 text-center">¥ {{ totalStats.expense.toFixed(2) }}</p>
                    </div>
                    <div class="col-span-2 bg-indigo-600 p-3 rounded-xl shadow-xs border border-indigo-700">
                        <p class="text-[9px] md:text-[10px] font-bold text-indigo-200 uppercase text-center">总核算利润 (Profit)</p>
                        <p class="text-lg md:text-xl font-black text-white text-center">¥ {{ (totalStats.income - totalStats.expense).toFixed(2) }}</p>
                    </div>
                </div>
            </div>

            <div class="flex flex-wrap gap-2 shrink-0">
                <!-- 应急解锁与重置按钮 -->
                <button v-if="isLoggedIn" @click="resetInteraction" title="当页面点击无反应或输入框受阻时，点击一键恢复" 
                        class="bg-white hover:bg-slate-100 text-indigo-600 border border-indigo-200 px-3 py-2 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 transition-all">
                    <span>🔓 解锁/恢复编辑</span>
                </button>
                <!-- ⚙️ AI 全局云端接口配置 -->
                <button v-if="isLoggedIn" @click="openAiSettingsModal" 
                        class="bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5">
                    <span>⚙️ AI 接口池 ({{ parseKeyCount }}个Key)</span>
                    <span class="w-2 h-2 rounded-full" :class="parseKeyCount > 0 ? 'bg-emerald-500' : 'bg-amber-400'"></span>
                </button>
                <button v-if="isLoggedIn" @click="manualSave" class="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs transition-colors">手动保存 (Save)</button>
                <button v-if="isLoggedIn" @click="exportToExcel" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs transition-colors">导出备份 (Export)</button>
                <button v-if="isLoggedIn" @click="addNewMonth" class="bg-slate-800 hover:bg-slate-900 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-xs transition-colors">+ 新增月份 (New Month)</button>
            </div>
        </header>

        <!-- 🌟 断点恢复提醒栏（如果上次有未导入的 AI 预览） -->
        <div v-if="hasPendingBatchPreview" class="mb-5 p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col md:flex-row justify-between items-center gap-2 text-xs">
            <div class="flex items-center gap-2 text-indigo-800 font-bold">
                <span class="text-base">⚡</span>
                <span>检测到上次有未确认导入的 AI 识别账单（共 {{ pendingPreviewRowCount }} 天），是否直接恢复？</span>
            </div>
            <div class="flex gap-2">
                <button @click="restorePendingBatchPreview" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg font-bold shadow-xs">立即恢复预览</button>
                <button @click="discardPendingBatchPreview" class="bg-white hover:bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg border border-slate-200">放弃</button>
            </div>
        </div>

        <!-- 月份列表 -->
        <div v-for="(monthBlock, mIdx) in months" :key="monthBlock.id" 
             :class="['mb-8 bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden', monthBlock.isHidden ? 'month-hidden' : '']">
            
            <div class="month-gradient p-4 md:p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="w-full md:w-auto">
                    <input v-if="isLoggedIn" v-model="monthBlock.monthName" @input="onUserEdit" @change="onUserEdit" @blur="onUserEdit" class="text-xl font-black bg-transparent border-b-2 border-indigo-200 focus:border-indigo-500 outline-none w-44">
                    <h2 v-else class="text-xl font-black text-slate-800">{{ monthBlock.monthName }}</h2>
                    <div v-if="isLoggedIn" class="flex gap-2 mt-2">
                        <button @click="deleteMonth(mIdx)" class="text-rose-400 text-[10px] border border-rose-100 px-2 py-0.5 rounded-md bg-white hover:bg-rose-50">删除月份 (Delete)</button>
                        <button @click="toggleHideMonth(mIdx)" :class="monthBlock.isHidden ? 'bg-indigo-500 text-white border-indigo-500' : 'text-slate-400 border-slate-200 bg-white'" class="text-[10px] border px-2 py-0.5 rounded-md">
                            {{ monthBlock.isHidden ? '取消隐藏 (Show)' : '隐藏统计 (Hide)' }}
                        </button>
                    </div>
                </div>
                
                <div class="flex w-full md:w-auto justify-between md:gap-8 bg-white/50 p-3 rounded-xl border border-white md:bg-transparent md:p-0 md:border-0">
                    <div class="text-center font-mono flex-1"><p class="text-[9px] font-bold text-slate-400">支</p><p class="text-base md:text-lg font-black text-emerald-600">¥ {{ calcMonth(monthBlock).expense.toFixed(2) }}</p></div>
                    <div class="text-center font-mono flex-1 border-l border-slate-200 md:border-0"><p class="text-[9px] font-bold text-slate-400">收</p><p class="text-base md:text-lg font-black text-rose-500">¥ {{ calcMonth(monthBlock).income.toFixed(2) }}</p></div>
                    <div class="text-right border-l pl-4 md:pl-8 border-slate-200 flex-1">
                        <p class="text-[9px] font-bold text-indigo-400">利润 (Profit)</p>
                        <p class="text-base md:text-lg font-black text-indigo-600">¥ {{ (calcMonth(monthBlock).income - calcMonth(monthBlock).expense).toFixed(2) }}</p>
                    </div>
                </div>
            </div>

            <!-- 🌟 微信聊天记录快速粘贴 & 多日批量 AI 智能解析入口 -->
            <div v-if="isLoggedIn" class="bg-indigo-50/40 p-4 border-b border-indigo-100/70">
                <div class="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                    <div class="flex-1">
                        <textarea v-model="aiTextInputs[monthBlock.id]" rows="3" 
                                  placeholder="在此粘贴单日或【连续多天/整周/整月】微信账目（例如：&#10;9月19日红章支出333.5我支出6.5烨文支出6坤艳支出3总共支出349收入473.5&#10;9月20日爸买菜150我买调料20收入580&#10;9月21日红章支出200姨买耗材50收入600备注：换了灯泡）...&#10;💡 说明：除红章(爸)、坤如(妈)外，其他人(烨文/坤艳/姨等)全部自动归为姨，且多笔会自动写成 6+3 并把名字记入备注！已开启本地自动防丢失保护。" 
                                  class="w-full text-xs p-2.5 rounded-lg border border-indigo-200 focus:border-indigo-500 outline-none bg-white leading-relaxed"></textarea>
                    </div>
                    <div class="flex md:flex-col gap-2 shrink-0">
                        <button @click="startBatchParseWithAi(mIdx, monthBlock)" 
                                :disabled="isAiParsing"
                                class="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-all">
                            <span v-if="isAiParsing">🤖 {{ aiStatusTip || 'AI 思考解析中...' }}</span>
                            <span v-else>⚡ 智能识别（单日/多日）</span>
                        </button>
                        <button @click="clearAiText(monthBlock.id)" 
                                class="text-[11px] text-slate-400 hover:text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-md">
                            清空输入
                        </button>
                    </div>
                </div>
            </div>

            <div class="overflow-x-auto custom-scrollbar">
                <table class="w-full border-collapse">
                    <thead>
                        <tr class="text-[10px] font-bold text-slate-400 uppercase bg-slate-50">
                            <th class="p-2.5 text-left date-col">日期</th>
                            <th v-for="(name, nIdx) in (monthBlock.memberNames || ['红章', '坤如', '姨'])" :key="nIdx" colspan="2" class="p-2.5 text-center border-l bg-emerald-50/20 text-emerald-700">
                                <div class="flex items-center justify-center gap-1">
                                    <span class="font-bold">{{ name }}</span>
                                    <span v-if="nIdx === 0" class="text-[9px] text-slate-400 font-normal">(爸)</span>
                                    <span v-else-if="nIdx === 1" class="text-[9px] text-slate-400 font-normal">(妈)</span>
                                    <span v-else-if="nIdx === 2" class="text-[9px] text-indigo-400 font-normal">(其他人·算式)</span>
                                </div>
                            </th>
                            <th class="p-2.5 text-center border-l text-rose-600 bg-rose-50/10 min-w-[125px]">收入细分 (微/支/现)</th>
                            <th class="p-2.5 text-center border-l bg-emerald-50/20 text-emerald-600">日支</th>
                            <th class="p-2.5 text-center border-l bg-rose-50/20 text-rose-600">日收</th>
                            <th class="p-2.5 text-right border-l font-black bg-slate-100 text-slate-700">当日盈亏</th>
                            <th class="p-2.5 text-center border-l bg-indigo-50/30 text-indigo-700 note-col">备注说明</th>
                            <th v-if="isLoggedIn" class="p-2.5 border-l w-10"></th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <tr v-for="(row, rIdx) in monthBlock.rows" :key="row.id" class="hover:bg-slate-50/70 transition-colors">
                            <td class="p-1 border-r date-col">
                                <input v-if="isLoggedIn" v-model="row.date" @input="onUserEdit" @change="onUserEdit" @blur="onUserEdit" 
                                       class="data-input font-bold text-slate-700 text-xs text-center focus:ring-1 focus:ring-indigo-400 rounded" placeholder="如 10/1">
                                <span v-else class="font-bold text-slate-600 text-[11px] block text-center">{{ row.date }}</span>
                            </td>

                            <template v-for="m in [['f_it', 'f_am', 'f_ck'], ['m_it', 'm_am', 'm_ck'], ['a_it', 'a_am', 'a_ck']]">
                                <td class="p-1 border-l">
                                    <div class="flex flex-col gap-0.5 items-center">
                                        <input v-if="isLoggedIn" v-model="row[m[0]]" @input="onUserEdit" @change="onUserEdit" @blur="onUserEdit" 
                                               placeholder="品类" class="data-input text-[10px] text-slate-500 focus:ring-1 focus:ring-indigo-400 rounded">
                                        <span v-else class="text-[9px] text-slate-400 truncate w-16 text-center">{{ row[m[0]] || '-' }}</span>
                                        
                                        <input v-if="isLoggedIn" v-model="row[m[1]]" @input="onUserEdit" @change="onUserEdit" @blur="onUserEdit" placeholder="0" 
                                               :title="m[1] === 'a_am' ? '可直接输入算式（例如 6+3），日支将自动计算总和' : ''"
                                               class="data-input font-bold text-[12px] text-emerald-600 focus:ring-1 focus:ring-indigo-400 rounded">
                                        <span v-else class="font-mono font-bold text-[11px] text-emerald-500/70 text-center" :title="row[m[1]]">
                                            ¥{{ formatSum(row[m[1]]) }}
                                        </span>
                                    </div>
                                </td>
                                <td class="p-1 border-r bg-slate-50/30 w-10 text-center">
                                    <input v-if="isLoggedIn" type="checkbox" v-model="row[m[2]]" @change="onUserEdit" class="checkbox-custom">
                                    <span v-else-if="row[m[2]]" class="text-emerald-500 font-bold">✓</span>
                                    <span v-else class="text-slate-200">○</span>
                                </td>
                            </template>

                            <td class="p-1 border-r bg-rose-50/5">
                                <div class="flex justify-center gap-1">
                                    <template v-for="(i, idx) in ['i1','i2','i3']">
                                        <input v-if="isLoggedIn" v-model="row[i]" @input="onUserEdit" @change="onUserEdit" @blur="onUserEdit" 
                                               :placeholder="idx===0?'微':(idx===1?'支':'现')"
                                               class="data-input w-9 text-center text-[11px] font-bold text-rose-500 focus:ring-1 focus:ring-indigo-400 rounded">
                                        <span v-else class="text-[10px] font-mono text-rose-400/60 w-8 text-center">{{ solveFormula(row[i]) }}</span>
                                    </template>
                                </div>
                            </td>

                            <td class="p-1.5 border-r text-center bg-emerald-50/10"><span class="text-[11px] font-bold text-emerald-600">¥{{ calcDaySum(row, 'expense').toFixed(2) }}</span></td>
                            <td class="p-1.5 border-r text-center bg-rose-50/10"><span class="text-[11px] font-bold text-rose-500">¥{{ calcDaySum(row, 'income').toFixed(2) }}</span></td>
                            <td class="p-1.5 text-right bg-slate-50 font-black text-xs text-indigo-600">{{ (calcDaySum(row, 'income') - calcDaySum(row, 'expense')).toFixed(2) }}</td>
                            
                            <td class="p-1.5 border-l bg-indigo-50/10 text-center note-col">
                                <button v-if="row.note && row.note.trim()" 
                                        @click="openNoteEditor(row, monthBlock.monthName)"
                                        :title="row.note"
                                        class="group max-w-[120px] w-full inline-flex items-center justify-between gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-md text-[10px] font-medium transition-all shadow-xs">
                                    <span class="truncate text-left">📝 {{ row.note }}</span>
                                    <span class="opacity-0 group-hover:opacity-100 text-[8px] text-indigo-400">✏️</span>
                                </button>
                                
                                <button v-else-if="isLoggedIn" 
                                        @click="openNoteEditor(row, monthBlock.monthName)" 
                                        class="inline-flex items-center gap-0.5 text-[10px] text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded border border-dashed border-slate-200 hover:border-indigo-300 transition-colors">
                                    <span>+ 备注</span>
                                </button>
                                <span v-else class="text-[10px] text-slate-300">—</span>
                            </td>

                            <td v-if="isLoggedIn" class="p-1.5 text-center border-l"><button @click="deleteRow(mIdx, rIdx)" class="text-rose-300 hover:text-rose-500 p-1">✕</button></td>
                        </tr>
                    </tbody>
                </table>
                <div v-if="isLoggedIn" class="p-5 border-t border-dashed border-slate-200 flex justify-center sticky left-0">
                    <button @click="addRow(mIdx)" class="bg-indigo-50 text-indigo-600 px-8 py-2.5 rounded-full text-xs font-black tracking-widest hover:bg-indigo-100 transition-colors">+ 添加每日账单 (Add Row)</button>
                </div>
            </div>
        </div>

        <!-- 🌟 弹窗 1：独立沉浸式【备注说明便捷编辑器】 -->
        <div v-if="noteModal.show" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
                <div class="bg-gradient-to-r from-indigo-600 to-blue-600 p-4 text-white flex justify-between items-center">
                    <div>
                        <h3 class="text-sm font-black flex items-center gap-1.5">
                            <span>📝 账单详细备注说明</span>
                        </h3>
                        <p class="text-indigo-100 text-[11px] mt-0.5">月份：{{ noteModal.monthName }} ｜ 日期：{{ noteModal.targetRow ? noteModal.targetRow.date : '' }}</p>
                    </div>
                    <button @click="closeNoteEditor" class="text-white/80 hover:text-white text-lg font-bold p-1">✕</button>
                </div>

                <div class="p-5 space-y-3.5 text-xs">
                    <div>
                        <label class="font-bold text-slate-700 block mb-1.5 flex justify-between">
                            <span>备注详情内容：</span>
                            <span class="text-slate-400 text-[10px] font-normal">支持多行、长文本、消费人明细说明等</span>
                        </label>
                        <textarea v-model="noteModal.text" rows="4" 
                                  placeholder="在此输入详细备注（例如：烨文6元，坤艳3元、向爸转账 已被接收、换了灯泡等）..." 
                                  class="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none bg-slate-50/50 leading-relaxed"></textarea>
                    </div>

                    <div>
                        <span class="text-[10px] font-bold text-slate-400 block mb-1.5 uppercase tracking-wider">常用快捷短语 (点击追加)：</span>
                        <div class="flex flex-wrap gap-1.5">
                            <button v-for="tag in ['向爸转账 已被接收', '采购食材', '进货调料', '水电气费', '耗材采购', '退款抵扣', '设备维修']" 
                                    :key="tag" 
                                    @click="appendNoteTag(tag)"
                                    class="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 border border-slate-200/80 rounded-md text-[11px] transition-colors">
                                + {{ tag }}
                            </button>
                        </div>
                    </div>
                </div>

                <div class="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                    <button @click="clearNoteText" class="px-3 py-2 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded-xl text-xs">
                        清空
                    </button>
                    <button @click="closeNoteEditor" class="flex-1 bg-white hover:bg-slate-100 text-slate-600 font-bold py-2.5 rounded-xl border border-slate-200 text-xs transition-colors">
                        取消
                    </button>
                    <button @click="saveNoteEditor" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl shadow-md text-xs transition-colors">
                        ✓ 保存并同步
                    </button>
                </div>
            </div>
        </div>

        <!-- 🌟 弹窗 2：【单日 / 多日批量 AI 识别结果确认微调弹窗】 -->
        <div v-if="batchPreviewModal.show" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 md:p-6">
            <div class="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                <div class="bg-gradient-to-r from-indigo-600 to-blue-600 p-4 text-white flex justify-between items-center shrink-0">
                    <div>
                        <h3 class="text-base font-black flex items-center gap-2">
                            <span>📋 微信账目智能解析结果确认</span>
                            <span class="bg-indigo-800/80 text-[11px] px-2.5 py-0.5 rounded-full font-bold">共识别到 {{ batchPreviewModal.rows.length }} 天账单</span>
                        </h3>
                        <p class="text-indigo-100 text-[11px] mt-0.5">目标月份：{{ batchPreviewModal.monthName }} ｜ 每一天均可单独检查微调或移除</p>
                    </div>
                    <button @click="closeBatchPreviewModal" class="text-white/80 hover:text-white text-xl font-bold p-1">✕</button>
                </div>

                <div class="p-4 overflow-y-auto space-y-4 text-xs flex-1 custom-scrollbar">
                    <div v-for="(item, idx) in batchPreviewModal.rows" :key="item.id" 
                         class="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-3 relative group">
                        
                        <div class="flex justify-between items-center border-b border-slate-200 pb-2">
                            <div class="flex items-center gap-2">
                                <span class="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">第 {{ idx + 1 }} 天</span>
                                <div class="flex items-center gap-1.5 font-bold text-slate-700">
                                    <span>记账日期:</span>
                                    <input v-model="item.date" class="w-16 bg-white border border-indigo-200 rounded px-1.5 py-0.5 text-center font-bold text-indigo-600 outline-none">
                                </div>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="text-[11px] font-mono font-bold text-slate-500">
                                    支: <b class="text-emerald-600 font-bold">¥{{ calcDaySum(item, 'expense').toFixed(2) }}</b> ｜ 
                                    收: <b class="text-rose-500 font-bold">¥{{ calcDaySum(item, 'income').toFixed(2) }}</b>
                                </span>
                                <button @click="removeBatchRow(idx)" title="移除这天" class="text-rose-400 hover:text-rose-600 font-bold text-sm px-1.5 py-0.5 rounded hover:bg-rose-50">✕ 移除</button>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div class="bg-white p-2 rounded-lg border border-emerald-100 flex items-center gap-1.5">
                                <span class="font-bold text-slate-700 w-12 truncate text-[11px]">红章(爸)</span>
                                <input v-model="item.f_it" placeholder="品类" class="w-14 border-b border-slate-200 px-1 py-0.5 outline-none text-[10px] text-center text-slate-500">
                                <div class="flex-1 flex items-center">
                                    <span class="text-slate-400 text-[10px]">¥</span>
                                    <input v-model="item.f_am" class="font-bold text-emerald-600 border-b border-emerald-200 px-1 py-0.5 outline-none w-full text-center">
                                </div>
                                <input type="checkbox" v-model="item.f_ck" class="checkbox-custom">
                            </div>

                            <div class="bg-white p-2 rounded-lg border border-emerald-100 flex items-center gap-1.5">
                                <span class="font-bold text-slate-700 w-12 truncate text-[11px]">坤如(妈)</span>
                                <input v-model="item.m_it" placeholder="品类" class="w-14 border-b border-slate-200 px-1 py-0.5 outline-none text-[10px] text-center text-slate-500">
                                <div class="flex-1 flex items-center">
                                    <span class="text-slate-400 text-[10px]">¥</span>
                                    <input v-model="item.m_am" class="font-bold text-emerald-600 border-b border-emerald-200 px-1 py-0.5 outline-none w-full text-center">
                                </div>
                                <input type="checkbox" v-model="item.m_ck" class="checkbox-custom">
                            </div>

                            <div class="bg-white p-2 rounded-lg border border-indigo-100 flex items-center gap-1.5">
                                <span class="font-bold text-indigo-700 w-16 truncate text-[11px]" title="除爸妈外其他人全部归为姨，支持6+3算式">姨(其他人)</span>
                                <input v-model="item.a_it" placeholder="品类" class="w-12 border-b border-slate-200 px-1 py-0.5 outline-none text-[10px] text-center text-slate-500">
                                <div class="flex-1 flex items-center">
                                    <span class="text-slate-400 text-[10px]">¥</span>
                                    <input v-model="item.a_am" placeholder="如 6+3" title="可直接输入算式（例如 6+3）" class="font-bold text-indigo-600 border-b border-indigo-200 px-1 py-0.5 outline-none w-full text-center">
                                </div>
                                <input type="checkbox" v-model="item.a_ck" class="checkbox-custom">
                            </div>
                        </div>

                        <div class="flex flex-col md:flex-row gap-2 items-center">
                            <div class="flex items-center gap-1 bg-white p-1.5 rounded-lg border border-rose-100 w-full md:w-auto">
                                <span class="text-[10px] font-bold text-rose-500 shrink-0">微信收入: ¥</span>
                                <input v-model="item.i1" class="font-bold text-rose-500 w-20 text-center outline-none border-b border-rose-200">
                            </div>
                            <div class="flex-1 flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-slate-200 w-full">
                                <span class="text-[10px] text-slate-400 shrink-0">备注说明:</span>
                                <input v-model="item.note" placeholder="标注消费人员及特殊说明（如 烨文6元，坤艳3元）..." class="w-full text-[11px] text-slate-600 outline-none">
                            </div>
                        </div>
                    </div>
                </div>

                <div class="p-4 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-3 shrink-0">
                    <div class="text-xs font-bold text-slate-600 flex items-center gap-4">
                        <span>📊 汇总：</span>
                        <span>总支: <b class="text-emerald-600">¥ {{ batchTotalStats.expense.toFixed(2) }}</b></span>
                        <span>总收: <b class="text-rose-500">¥ {{ batchTotalStats.income.toFixed(2) }}</b></span>
                        <span>预估利润: <b class="text-indigo-600">¥ {{ (batchTotalStats.income - batchTotalStats.expense).toFixed(2) }}</b></span>
                    </div>
                    <div class="flex gap-2 w-full md:w-auto">
                        <button @click="closeBatchPreviewModal" class="flex-1 md:flex-none px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200 text-xs transition-colors">
                            ✕ 取消
                        </button>
                        <button @click="confirmAndInsertBatchRows" class="flex-1 md:flex-none px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs text-xs flex items-center justify-center gap-1.5 transition-colors">
                            <span>✓ 确认导入这 {{ batchPreviewModal.rows.length }} 天账单</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 🌟 弹窗 3：AI 多备用池与极速延迟检测配置弹窗 -->
        <div v-if="aiSettingsModal.show" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100">
                <div class="bg-gradient-to-r from-indigo-700 to-indigo-900 p-5 text-white flex justify-between items-center">
                    <div>
                        <h3 class="text-base font-black flex items-center gap-2">
                            <span>⚙️ AI 大模型接口设置 (503自动容灾池)</span>
                        </h3>
                        <p class="text-indigo-200 text-xs mt-0.5">支持多个 Key 自动轮询 + 503 自动故障重试与转移</p>
                    </div>
                    <button @click="aiSettingsModal.show = false" class="text-white/80 hover:text-white text-xl font-bold p-1">✕</button>
                </div>

                <div class="p-5 space-y-3.5 text-xs max-h-[75vh] overflow-y-auto">
                    <div>
                        <label class="font-bold text-slate-700 block mb-1">预设服务商切换：</label>
                        <select v-model="aiConfig.provider" @change="onProviderChange" class="w-full border border-slate-200 rounded-lg p-2.5 outline-none bg-slate-50">
                            <option value="gemini">Google Gemini (默认 gemini-3.7-flash，含 2.5/2.0 自动容灾)</option>
                            <option value="deepseek">DeepSeek 官方 (deepseek-chat)</option>
                            <option value="openai">OpenAI / 兼容通道 (GPT-4o / GPT-4o-mini)</option>
                            <option value="custom">自定义兼容 API 协议</option>
                        </select>
                    </div>

                    <div>
                        <div class="flex justify-between items-center mb-1">
                            <label class="font-bold text-slate-700">API Key 密钥池 (支持填入多个，一行一个)：</label>
                            <span class="text-[10px] text-indigo-600 font-bold">已识别 {{ parseKeyCount }} 个 Key</span>
                        </div>
                        <textarea v-model="aiConfig.apiKey" @input="triggerAiConfigAutoSave" rows="3" 
                                  placeholder="输入一个或多个 Gemini / DeepSeek API Key（可一行一个或逗号隔开，主 Key 遇 503 时自动切换下一个 Key）..." 
                                  class="w-full border border-slate-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 font-mono text-[11px]"></textarea>
                    </div>

                    <div>
                        <label class="font-bold text-slate-700 block mb-1">API 接口 Endpoint：</label>
                        <input v-model="aiConfig.endpoint" @input="triggerAiConfigAutoSave" placeholder="如 https://generativelanguage.googleapis.com/..." 
                               class="w-full border border-slate-200 rounded-lg p-2.5 outline-none text-slate-600 font-mono text-[11px]">
                    </div>

                    <div>
                        <label class="font-bold text-slate-700 block mb-1">模型名称 (Model Name)：</label>
                        <input v-model="aiConfig.modelName" @input="triggerAiConfigAutoSave" placeholder="如 gemini-3.7-flash" 
                               class="w-full border border-slate-200 rounded-lg p-2.5 outline-none font-bold text-indigo-600">
                    </div>

                    <!-- 纯轻量极速网络延迟探测 -->
                    <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-slate-700">⚡ 接口节点网络延迟探测：</span>
                            <button @click="testLatencyOnly" :disabled="isTestingApi" 
                                    class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg font-bold text-[11px] transition-colors">
                                {{ isTestingApi ? '⏳ 测速中...' : '测速 (Ping)' }}
                            </button>
                        </div>
                        <div v-if="latencyResult" class="p-2 rounded bg-white border text-[11px] flex justify-between items-center"
                             :class="latencyResult.ok ? 'border-emerald-200 text-emerald-700' : 'border-rose-200 text-rose-600'">
                            <span class="font-mono truncate w-56">{{ latencyResult.target }}</span>
                            <span class="font-bold">{{ latencyResult.msg }}</span>
                        </div>
                    </div>
                </div>

                <div class="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
                    <button @click="aiSettingsModal.show = false" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl shadow-md text-xs transition-colors">
                        ✓ 完成 (已自动实时同步云端)
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const { createApp } = Vue;
        createApp({
            data() {
                return {
                    isLoggedIn: ${enableEditMode},
                    months: [],
                    syncStatus: 'synced', // 'synced' | 'saving' | 'pending' | 'offline_cached'
                    isHydrating: false,    // 正在拉取或装载云端数据，期间阻断一切自动写入
                    isCloudSaving: false,  // 独占云端写入互斥锁
                    hasQueuedSave: false,  // 保存过程中有后续编辑产生，需在完成后立即连带保存
                    localModifiedTime: 0,  // 本地最后一次修改时间戳
                    lastCloudSyncTime: 0,  // 云端最后一次成功落盘时间戳
                    saveDebounceTimer: null,
                    aiSaveTimeout: null,
                    aiTextInputs: {},
                    isAiParsing: false,
                    aiStatusTip: '',
                    isTestingApi: false,
                    latencyResult: null,
                    aiConfig: {
                        provider: 'gemini',
                        endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
                        apiKey: '',
                        modelName: 'gemini-3.7-flash'
                    },
                    aiSettingsModal: { show: false },
                    batchPreviewModal: {
                        show: false,
                        monthIdx: 0,
                        monthName: '',
                        memberNames: ['红章', '坤如', '姨'],
                        rows: []
                    },
                    hasPendingBatchPreview: false,
                    pendingPreviewRowCount: 0,
                    noteModal: {
                        show: false,
                        targetRow: null,
                        monthName: '',
                        text: ''
                    }
                }
            },
            computed: {
                syncStatusText() {
                    switch (this.syncStatus) {
                        case 'saving': return '☁️ 正在保存至云端...';
                        case 'pending': return '💾 本地已秒级保护 (等待同步)';
                        case 'offline_cached': return '⚠️ 弱网/已本地保护 (自动重试中)';
                        case 'synced':
                        default: return '☁️ 云端实时已同步';
                    }
                },
                totalStats() {
                    let s = { income: 0, expense: 0 };
                    this.months.forEach(m => {
                        if (m.isHidden) return;
                        m.rows.forEach(r => {
                            s.income += this.calcDaySum(r, 'income');
                            s.expense += this.calcDaySum(r, 'expense');
                        });
                    });
                    return s;
                },
                parseKeyCount() {
                    return this.getKeyList().length;
                },
                batchTotalStats() {
                    let exp = 0, inc = 0;
                    this.batchPreviewModal.rows.forEach(r => {
                        exp += this.calcDaySum(r, 'expense');
                        inc += this.calcDaySum(r, 'income');
                    });
                    return { expense: exp, income: inc };
                }
            },
            watch: {
                months: {
                    handler() { 
                        if (this.isLoggedIn && !this.isHydrating) {
                            this.onUserEdit(); 
                        }
                    },
                    deep: true
                },
                aiConfig: {
                    handler() { if (this.isLoggedIn) this.triggerAiConfigAutoSave(); },
                    deep: true
                },
                aiTextInputs: {
                    handler(val) {
                        try {
                            localStorage.setItem('FINANCE_AI_TEXT_MAP', JSON.stringify(val));
                        } catch (_) {}
                    },
                    deep: true
                }
            },
            methods: {
                // 点击单元格快速聚焦内部输入框
                focusFirstInput(event) {
                    if (!this.isLoggedIn) return;
                    if (event.target && event.target.tagName !== 'INPUT') {
                        const input = event.currentTarget.querySelector('input');
                        if (input) input.focus();
                    }
                },

                // 🔓 一键重置交互与解除死锁状态
                resetInteraction() {
                    this.isAiParsing = false;
                    this.aiStatusTip = '';
                    this.noteModal.show = false;
                    this.aiSettingsModal.show = false;
                    this.isCloudSaving = false;
                    this.hasQueuedSave = false;
                    this.isHydrating = false;
                    clearTimeout(this.saveDebounceTimer);

                    // 尝试从本地安全备份自愈
                    try {
                        const raw = localStorage.getItem('FINANCE_LOCAL_BACKUP_V5');
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            if (parsed && Array.isArray(parsed.months) && parsed.months.length > 0) {
                                this.months = parsed.months;
                            }
                        }
                    } catch (_) {}

                    this.$forceUpdate();
                    alert('✅ 界面交互与编辑锁已全面自愈解锁！本地数据完好，可直接正常编辑。');
                },

                getKeyList() {
                    if (!this.aiConfig.apiKey) return [];
                    return this.aiConfig.apiKey
                        .split(/[\\r\\n,;\\t\\s]+/)
                        .map(k => k.trim())
                        .filter(k => k.length > 5);
                },

                // 纯轻量极速网络延迟探测
                async testLatencyOnly() {
                    this.isTestingApi = true;
                    this.latencyResult = null;

                    let targetUrl = this.aiConfig.endpoint || 'https://generativelanguage.googleapis.com';
                    let targetHost = targetUrl;
                    try {
                        const u = new URL(targetUrl);
                        targetHost = u.origin;
                    } catch (_) {}

                    const t0 = performance.now();
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 2500);

                    try {
                        await fetch(targetHost, {
                            method: 'HEAD',
                            mode: 'no-cors',
                            cache: 'no-cache',
                            signal: controller.signal
                        }).catch(async () => {
                            await fetch(targetHost, {
                                method: 'GET',
                                mode: 'no-cors',
                                cache: 'no-cache',
                                signal: controller.signal
                            });
                        });

                        clearTimeout(timeoutId);
                        const latency = Math.round(performance.now() - t0);
                        this.latencyResult = {
                            target: targetHost,
                            ok: true,
                            msg: \`🟢 网络正常 (\${latency} ms)\`
                        };
                    } catch (e) {
                        clearTimeout(timeoutId);
                        const latency = Math.round(performance.now() - t0);
                        if (e.name === 'AbortError') {
                            this.latencyResult = {
                                target: targetHost,
                                ok: false,
                                msg: '🔴 响应超时 (>2500ms)'
                            };
                        } else {
                            this.latencyResult = {
                                target: targetHost,
                                ok: false,
                                msg: \`🔴 握手失败 (\${latency}ms)\`
                            };
                        }
                    } finally {
                        this.isTestingApi = false;
                    }
                },

                openNoteEditor(row, monthName) {
                    if (!this.isLoggedIn) return;
                    this.noteModal = {
                        show: true,
                        targetRow: row,
                        monthName: monthName,
                        text: row.note || ''
                    };
                },
                closeNoteEditor() {
                    this.noteModal.show = false;
                },
                appendNoteTag(tag) {
                    if (!this.noteModal.text || !this.noteModal.text.trim()) {
                        this.noteModal.text = tag;
                    } else if (!this.noteModal.text.includes(tag)) {
                        this.noteModal.text = this.noteModal.text.trim() + ' ' + tag;
                    }
                },
                clearNoteText() {
                    this.noteModal.text = '';
                },
                saveNoteEditor() {
                    if (this.noteModal.targetRow) {
                        this.noteModal.targetRow.note = this.noteModal.text.trim();
                        this.triggerAutoSave();
                    }
                    this.noteModal.show = false;
                },

                async startBatchParseWithAi(mIdx, monthBlock) {
                    const text = this.aiTextInputs[monthBlock.id];
                    if (!text || !text.trim()) {
                        alert('请先在输入框中粘贴微信聊天记录！');
                        return;
                    }

                    const keys = this.getKeyList();
                    if (keys.length === 0) {
                        const goSetting = confirm('检测到尚未配置 API Key。是否前往配置 Gemini API Key 池？\\n(点击取消将使用本地应急备用解析器)');
                        if (goSetting) {
                            this.openAiSettingsModal();
                            return;
                        }
                        const fallback = this.parseWithLocalRulesMulti(text, monthBlock);
                        if (fallback && fallback.length > 0) this.openBatchPreviewModal(mIdx, monthBlock, fallback);
                        return;
                    }

                    this.isAiParsing = true;
                    this.aiStatusTip = '正在连接 AI 分析中...';

                    const systemPrompt = \`你是一个专业的餐厅与家庭财务记账AI助手。请从用户输入的微信聊天记录或账单文本中提取财务数据。用户可能输入【单天】或【连续多天/整周/整月】的记录。
请严格输出纯 JSON 数组，数组中每个对象代表一天的记账数据。

【成员槽位与分类规则（最高铁律）】：
1. 槽位0 (对应【红章】)：
   - 包含别名：红章、爸、父、老爸。
2. 槽位1 (对应【坤如】)：
   - 包含别名：坤如、坤茹、妈、母、老妈、我。
3. 槽位2 (对应【姨】/其他人)：
   - 核心规则：除了红章（爸）和坤如（妈/我）之外，所有其他人（包括烨文、坤艳、姨、姑、舅或任何其他第三人、第四人、未知名人名）全部统一归入槽位2【姨】！
   - 多人/多笔消费格式（极重要）：
     - 当一天中有第三个人、第四个人（例如烨文消费6元、坤艳消费3元），或者有多笔其他人消费时：
       - 槽位2金额 (slot2_amount) 必须写成加法算式字符串，例如 "6+3"（严禁直接合并算成9，必须保留算式让账目清晰可查！若是单人单笔则直接写数字如 "6"）；
       - 必须在 note（备注）中明确写出具体是谁消费的！格式如 "烨文6元，坤艳3元"；如果该天已有其他备注（如"采购灯泡"），则合并为 "采购灯泡 (烨文6元，坤艳3元)"。
4. 严禁只提取总支出！必须为每个出现的成员分别提取独立的支出金额。
5. 收入提取：提取微信收入填入 income_wechat，支付宝填入 income_alipay，现金填入 income_cash。
6. 日期格式统一如 "9/19" 或 "10/1"。

【输出 JSON 数组格式示例】：
[
  {
    "date": "9/19",
    "slot0_amount": "333.5",
    "slot0_item": "日常支出",
    "slot1_amount": "6.5",
    "slot1_item": "调料",
    "slot2_amount": "6+3",
    "slot2_item": "采购",
    "income_wechat": "473.5",
    "income_alipay": "0",
    "income_cash": "0",
    "note": "烨文6元，坤艳3元"
  }
]
只输出纯 JSON 数组，绝对不要包含任何 markdown 标签或多余解释！\`;

                    const modelCandidates = [
                        this.aiConfig.modelName || 'gemini-3.7-flash',
                        'gemini-2.5-flash',
                        'gemini-2.0-flash',
                        'gemini-1.5-flash'
                    ];

                    let parseSuccess = false;
                    let parsedDataArray = [];

                    for (let k = 0; k < keys.length && !parseSuccess; k++) {
                        const currentKey = keys[k];
                        for (let m = 0; m < modelCandidates.length && !parseSuccess; m++) {
                            const currentModel = modelCandidates[m];
                            const reqController = new AbortController();
                            const reqTimeout = setTimeout(() => reqController.abort(), 15000); // 15秒超时熔断防死锁
                            try {
                                this.aiStatusTip = \`尝试 Key #\${k+1} (\${currentModel})...\`;
                                const res = await fetch(this.aiConfig.endpoint, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': \`Bearer \${currentKey}\`
                                    },
                                    body: JSON.stringify({
                                        model: currentModel,
                                        messages: [
                                            { role: 'system', content: systemPrompt },
                                            { role: 'user', content: text }
                                        ],
                                        temperature: 0.1
                                    }),
                                    signal: reqController.signal
                                });
                                clearTimeout(reqTimeout);

                                if (res.status === 503 || res.status === 429) {
                                    console.warn(\`API Key #\${k+1} 模型 \${currentModel} 返回 \${res.status} 过载，自动切换下一个备用...\`);
                                    await new Promise(r => setTimeout(r, 500));
                                    continue;
                                }

                                if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
                                const data = await res.json();
                                let raw = data.choices[0].message.content || '';
                                raw = raw.replace(/\\\`\\\`\\\`json/g, '').replace(/\\\`\\\`\\\`/g, '').trim();
                                
                                let jsonRes = JSON.parse(raw);
                                if (!Array.isArray(jsonRes)) jsonRes = [jsonRes];

                                parsedDataArray = jsonRes.map(p => ({
                                    id: 'r_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                                    date: p.date || '',
                                    f_it: p.slot0_item || '',
                                    f_am: p.slot0_amount !== undefined ? p.slot0_amount.toString() : '0',
                                    f_ck: this.solveFormula(p.slot0_amount) > 0,
                                    m_it: p.slot1_item || '',
                                    m_am: p.slot1_amount !== undefined ? p.slot1_amount.toString() : '0',
                                    m_ck: this.solveFormula(p.slot1_amount) > 0,
                                    a_it: p.slot2_item || '',
                                    a_am: p.slot2_amount !== undefined ? p.slot2_amount.toString() : '0',
                                    a_ck: this.solveFormula(p.slot2_amount) > 0,
                                    i1: p.income_wechat ? p.income_wechat.toString() : '0',
                                    i2: p.income_alipay ? p.income_alipay.toString() : '0',
                                    i3: p.income_cash ? p.income_cash.toString() : '0',
                                    note: p.note || ''
                                }));

                                parseSuccess = true;
                                break;
                            } catch (err) {
                                clearTimeout(reqTimeout);
                                console.warn(\`Key #\${k+1} \${currentModel} 尝试失败: \${err.message}\`);
                            }
                        }
                    }

                    if (parseSuccess && parsedDataArray.length > 0) {
                        this.openBatchPreviewModal(mIdx, monthBlock, parsedDataArray);
                    } else {
                        alert('云端 AI 接口暂时均处于过载状态 (503/超时)，已自动切换为本地多日规则解析引擎！');
                        const fallback = this.parseWithLocalRulesMulti(text, monthBlock);
                        if (fallback && fallback.length > 0) this.openBatchPreviewModal(mIdx, monthBlock, fallback);
                    }

                    this.isAiParsing = false;
                    this.aiStatusTip = '';
                },

                // 🌟 本地智能多日规则解析引擎（严格执行：红章/坤如/姨分类，多人形成算式如 6+3，备注标注消费人）
                parseWithLocalRulesMulti(text, monthBlock) {
                    const lines = text.split(/[\\r\\n]+/);
                    const rows = [];
                    const filterWords = ['共', '总', '合计', '共计', '总计', '总共', '收入', '入账', '进账', '营业额', '收钱', '转账', '已被接收', '已接收', '备注', '说明', '微信', '用户', '向', '给', '支出'];

                    lines.forEach(line => {
                        const trimmed = line.trim();
                        if (!trimmed) return;

                        // 提取日期
                        let rowDate = '';
                        const dateMatch = trimmed.match(/(\\d{1,2})[月\\-\\/](\\d{1,2})日?/);
                        if (dateMatch) {
                            rowDate = \`\${parseInt(dateMatch[1])}/\${parseInt(dateMatch[2])}\`;
                        } else {
                            const now = new Date();
                            rowDate = \`\${now.getMonth() + 1}/\${now.getDate()}\`;
                        }

                        // 提取收入
                        let incomeStr = '0';
                        const incMatch = trimmed.match(/(?:今日|当天|总)?(?:收入|入账|进账|营业额|收钱|总收款|收款)\\s*[:：=]?\\s*([0-9]+(?:\\.[0-9]+)?)/i);
                        if (incMatch) incomeStr = incMatch[1];

                        // 提取原有备注
                        let noteStr = '';
                        const noteMatch = trimmed.match(/(?:备注|说明|特注)[:：\\s]*(.*)$/);
                        if (noteMatch) noteStr = noteMatch[1].trim();

                        let fatherAmt = 0;
                        let motherAmt = 0;
                        let auntRecords = []; // 存放槽位2（姨）的所有其他人员记录 [{ name: '烨文', amt: '6' }, { name: '坤艳', amt: '3' }]

                        // 4. 清理干扰文本（日期、收入、原备注、总支出/共计等）
                        let cleaned = trimmed;
                        if (dateMatch) cleaned = cleaned.replace(dateMatch[0], ' ');
                        if (incMatch) cleaned = cleaned.replace(incMatch[0], ' ');
                        if (noteMatch) cleaned = cleaned.replace(noteMatch[0], ' ');
                        cleaned = cleaned.replace(/(?:共支出|总支出|合计支出|共计支出|总计|共计|总共支出|总共|合计|共)\s*[:：=]?\s*[0-9]+(?:\.[0-9]+)?/g, ' ');

                        // 5. 提取个人支出（兼顾：红章支出333.5、爸买菜150、红章: 200、烨文6元 等）
                        const expenseRegex = /([^\d\s,，.。:：=;；、]+?)\s*(?:支出|花费|花了|用去|采购|出账|买菜|买调料|买耗材|买水果|买东西|垫付|买|付|[:：=])\s*([0-9]+(?:\.[0-9]+)?)/g;
                        let m;
                        while ((m = expenseRegex.exec(cleaned)) !== null) {
                            let rawName = m[1].replace(/^\d{1,2}月\d{1,2}日/, '').replace(/^(?:微信|用户|向|给)[:：\s]*/, '').replace('支出', '').trim();
                            if (filterWords.includes(rawName) || !rawName) continue;
                            const amt = parseFloat(m[2]);
                            if (isNaN(amt) || amt <= 0) continue;
                            const amtStr = m[2];

                            // 严格规则：
                            // 红章 (爸) -> 槽位 0
                            // 坤如 (妈/我) -> 槽位 1
                            // 其他所有人全部归为 姨 (槽位 2)
                            if (['红章', '爸', '父', '老爸'].includes(rawName)) {
                                fatherAmt += amt;
                            } else if (['坤如', '坤茹', '妈', '母', '老妈', '我'].includes(rawName)) {
                                motherAmt += amt;
                            } else {
                                auntRecords.push({ name: rawName, amt: amtStr });
                            }
                        }

                        // 格式化槽位2（姨）的金额与备注
                        let auntAmtStr = '0';
                        let auntNotes = [];
                        if (auntRecords.length === 1) {
                            auntAmtStr = auntRecords[0].amt;
                            if (auntRecords[0].name !== '姨') {
                                auntNotes.push(\`\${auntRecords[0].name}\${auntRecords[0].amt}元\`);
                            }
                        } else if (auntRecords.length > 1) {
                            // 关键优化：多笔写成例如 6+3 算式！
                            auntAmtStr = auntRecords.map(r => r.amt).join('+');
                            // 并在备注里写上是谁消费的！
                            auntNotes = auntRecords.map(r => \`\${r.name}\${r.amt}元\`);
                        }

                        // 组合最终备注
                        let finalNote = noteStr;
                        if (auntNotes.length > 0) {
                            const whoSpent = auntNotes.join('，');
                            if (finalNote) {
                                finalNote = \`\${finalNote} (\${whoSpent})\`;
                            } else {
                                finalNote = whoSpent;
                            }
                        }

                        rows.push({
                            id: 'r_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                            date: rowDate,
                            f_it: '', f_am: fatherAmt > 0 ? fatherAmt.toString() : '0', f_ck: fatherAmt > 0,
                            m_it: '', m_am: motherAmt > 0 ? motherAmt.toString() : '0', m_ck: motherAmt > 0,
                            a_it: '', a_am: auntAmtStr !== '0' ? auntAmtStr : '0', a_ck: auntAmtStr !== '0',
                            i1: incomeStr, i2: '0', i3: '0', note: finalNote
                        });
                    });

                    return rows.length > 0 ? rows : [{
                        id: 'r_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                        date: \`\${new Date().getMonth()+1}/\${new Date().getDate()}\`,
                        f_it: '', f_am: '0', f_ck: false, m_it: '', m_am: '0', m_ck: false, a_it: '', a_am: '0', a_ck: false, i1: '0', i2: '0', i3: '0', note: ''
                    }];
                },

                openBatchPreviewModal(mIdx, monthBlock, parsedRows) {
                    this.batchPreviewModal = {
                        show: true,
                        monthIdx: mIdx,
                        monthName: monthBlock.monthName,
                        memberNames: ['红章', '坤如', '姨'],
                        rows: parsedRows
                    };
                    // 🌟 自动在本地做断点备份，防止用户不小心刷新导致识别结果丢失！
                    try {
                        localStorage.setItem('FINANCE_PENDING_BATCH_PREVIEW', JSON.stringify({
                            modal: this.batchPreviewModal,
                            savedAt: Date.now()
                        }));
                        this.hasPendingBatchPreview = true;
                        this.pendingPreviewRowCount = parsedRows.length;
                    } catch (_) {}
                },

                closeBatchPreviewModal() {
                    this.batchPreviewModal.show = false;
                    try {
                        localStorage.removeItem('FINANCE_PENDING_BATCH_PREVIEW');
                        this.hasPendingBatchPreview = false;
                    } catch (_) {}
                },

                removeBatchRow(idx) {
                    this.batchPreviewModal.rows.splice(idx, 1);
                    if (this.batchPreviewModal.rows.length === 0) {
                        this.closeBatchPreviewModal();
                    }
                },

                confirmAndInsertBatchRows() {
                    const mIdx = this.batchPreviewModal.monthIdx;
                    if (this.months[mIdx]) {
                        this.batchPreviewModal.rows.forEach(r => {
                            this.months[mIdx].rows.push({ 
                                ...r, 
                                id: 'r_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6) 
                            });
                        });
                        const monthId = this.months[mIdx].id;
                        this.aiTextInputs[monthId] = '';
                        this.closeBatchPreviewModal();
                        this.triggerAutoSave();
                    }
                },

                clearAiText(monthId) {
                    this.aiTextInputs[monthId] = '';
                    try {
                        let cached = JSON.parse(localStorage.getItem('FINANCE_AI_TEXT_MAP') || '{}');
                        delete cached[monthId];
                        localStorage.setItem('FINANCE_AI_TEXT_MAP', JSON.stringify(cached));
                    } catch (_) {}
                },

                // 检查并恢复未导入的 AI 识别账单
                checkPendingBatchPreview() {
                    try {
                        const raw = localStorage.getItem('FINANCE_PENDING_BATCH_PREVIEW');
                        if (raw) {
                            const data = JSON.parse(raw);
                            if (data && data.modal && Array.isArray(data.modal.rows) && data.modal.rows.length > 0) {
                                // 24小时内有效
                                if (Date.now() - (data.savedAt || 0) < 86400000) {
                                    this.hasPendingBatchPreview = true;
                                    this.pendingPreviewRowCount = data.modal.rows.length;
                                    this._pendingBackupData = data.modal;
                                    return;
                                }
                            }
                        }
                    } catch (_) {}
                    this.hasPendingBatchPreview = false;
                },

                restorePendingBatchPreview() {
                    if (this._pendingBackupData) {
                        this.batchPreviewModal = { ...this._pendingBackupData, show: true };
                        this.hasPendingBatchPreview = false;
                    }
                },

                discardPendingBatchPreview() {
                    try {
                        localStorage.removeItem('FINANCE_PENDING_BATCH_PREVIEW');
                    } catch (_) {}
                    this.hasPendingBatchPreview = false;
                    this._pendingBackupData = null;
                },

                openAiSettingsModal() {
                    this.aiSettingsModal.show = true;
                },

                onProviderChange() {
                    if (this.aiConfig.provider === 'gemini') {
                        this.aiConfig.endpoint = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
                        this.aiConfig.modelName = 'gemini-3.7-flash';
                    } else if (this.aiConfig.provider === 'deepseek') {
                        this.aiConfig.endpoint = 'https://api.deepseek.com/chat/completions';
                        this.aiConfig.modelName = 'deepseek-chat';
                    } else if (this.aiConfig.provider === 'openai') {
                        this.aiConfig.endpoint = 'https://api.openai.com/v1/chat/completions';
                        this.aiConfig.modelName = 'gpt-4o';
                    }
                    this.triggerAiConfigAutoSave();
                },

                triggerAiConfigAutoSave() {
                    if (!this.isLoggedIn) return;
                    this.saving = true;
                    clearTimeout(this.aiSaveTimeout);
                    this.aiSaveTimeout = setTimeout(async () => {
                        try {
                            const res = await fetch('/api/save-ai-config', {
                                method: 'POST',
                                headers: { 'Authorization': 'auth_lz_mode' },
                                body: JSON.stringify(this.aiConfig)
                            });
                            if (!res.ok) throw new Error('云端存储失败');
                            localStorage.setItem('FINANCE_AI_CONFIG', JSON.stringify(this.aiConfig));
                        } catch (e) {
                            console.error('Save AI Config error:', e);
                        } finally {
                            this.saving = false;
                        }
                    }, 800);
                },

                async loadAiSettingsFromCloud() {
                    try {
                        const res = await fetch('/api/get-ai-config');
                        if (res.ok) {
                            const cloudConfig = await res.json();
                            if (cloudConfig && (cloudConfig.apiKey || cloudConfig.endpoint)) {
                                this.aiConfig = { ...this.aiConfig, ...cloudConfig };
                                localStorage.setItem('FINANCE_AI_CONFIG', JSON.stringify(this.aiConfig));
                                return;
                            }
                        }
                    } catch (_) {}

                    try {
                        const saved = localStorage.getItem('FINANCE_AI_CONFIG');
                        if (saved) this.aiConfig = { ...this.aiConfig, ...JSON.parse(saved) };
                    } catch (_) {}
                },

                // 🌟 算式增强求解器：支持例如 6+3、6.5+3.5、带空格或全角加号算式
                solveFormula(val) {
                    if (val === null || val === undefined || val === '') return 0;
                    if (typeof val === 'number') return isNaN(val) ? 0 : val;
                    try {
                        let cleanStr = val.toString().replace(/[\\s\\r\\n]+/g, '').replace(/^=/, '').replace(/＋/g, '+');
                        if (!cleanStr) return 0;
                        const parts = cleanStr.split('+').filter(p => p.length > 0);
                        if (parts.length === 0) return 0;
                        const sum = parts.reduce((total, part) => {
                            const num = parseFloat(part);
                            return total + (isNaN(num) ? 0 : num);
                        }, 0);
                        return Math.round(sum * 10000) / 10000;
                    } catch { return 0; }
                },

                formatSum(val) {
                    const res = this.solveFormula(val);
                    return res === 0 ? '0' : res.toFixed(2);
                },

                calcDaySum(row, type) {
                    if (!row) return 0;
                    if (type === 'income') return this.solveFormula(row.i1) + this.solveFormula(row.i2) + this.solveFormula(row.i3);
                    return this.solveFormula(row.f_am) + this.solveFormula(row.m_am) + this.solveFormula(row.a_am);
                },

                // 用户任何操作或输入触发的统一更新入口
                onUserEdit() {
                    if (!this.isLoggedIn || this.isHydrating) return;
                    this.localModifiedTime = Date.now();
                    // 1. 毫秒级本地主数据镜像（无论网络如何，本地绝对 100% 存盘防丢）
                    try {
                        localStorage.setItem('FINANCE_LOCAL_BACKUP_V5', JSON.stringify({
                            months: this.months,
                            time: this.localModifiedTime
                        }));
                    } catch (_) {}
                    this.syncStatus = 'pending';
                    this.scheduleCloudSave(400);
                },

                scheduleCloudSave(delay = 400) {
                    if (!this.isLoggedIn) return;
                    clearTimeout(this.saveDebounceTimer);
                    this.saveDebounceTimer = setTimeout(() => {
                        this.executeCloudSave();
                    }, delay);
                },

                async executeCloudSave() {
                    if (!this.isLoggedIn) return;
                    // 单通道串行互斥：若当前已有请求在线，排队标记并在返回后继续，杜绝多请求乱序覆盖！
                    if (this.isCloudSaving) {
                        this.hasQueuedSave = true;
                        return;
                    }
                    this.isCloudSaving = true;
                    this.syncStatus = 'saving';

                    const savePayload = JSON.stringify(this.months);
                    const controller = new AbortController();
                    const timer = setTimeout(() => controller.abort(), 12000); // 12秒防死锁超时熔断

                    try {
                        const uniqueUrl = '/api/save?_t=' + Date.now() + '_' + Math.random().toString(36).slice(2);
                        const res = await fetch(uniqueUrl, {
                            method: 'POST',
                            headers: { 
                                'Authorization': 'auth_lz_mode',
                                'Content-Type': 'application/json',
                                'Cache-Control': 'no-cache, no-store, must-revalidate',
                                'Pragma': 'no-cache'
                            },
                            body: savePayload,
                            cache: 'no-store',
                            signal: controller.signal
                        });
                        clearTimeout(timer);
                        if (!res.ok) throw new Error('云端写入失败 HTTP ' + res.status);
                        
                        this.lastCloudSyncTime = Date.now();
                        this.isCloudSaving = false;

                        // 检查在保存等待期间是否又发生了新的用户输入
                        if (this.hasQueuedSave) {
                            this.hasQueuedSave = false;
                            this.scheduleCloudSave(50);
                        } else {
                            this.syncStatus = 'synced';
                        }
                    } catch (e) {
                        clearTimeout(timer);
                        console.warn('Cloud save network fallback:', e);
                        this.isCloudSaving = false;
                        this.syncStatus = 'offline_cached';
                        // 失败后后台 3 秒静默自愈重试，无需用户手动刷新
                        setTimeout(() => {
                            if (this.syncStatus === 'offline_cached' || this.hasQueuedSave) {
                                this.scheduleCloudSave(300);
                            }
                        }, 3000);
                    }
                },

                async manualSave() {
                    if (!this.isLoggedIn) return;
                    clearTimeout(this.saveDebounceTimer);
                    this.onUserEdit();
                    await this.executeCloudSave();
                    if (this.syncStatus === 'synced') {
                        alert('✅ 云端同步成功！数据已永久持久化。');
                    } else {
                        alert('⚠️ 当前网络响应较慢，已在您的设备完成毫秒级本地存盘保护，后台正在持续自动重试同步。');
                    }
                },

                exportToExcel() {
                    const allData = [];
                    this.months.forEach(m => {
                        if (m.isHidden) return;
                        const mNames = m.memberNames || ['红章', '坤如', '姨'];
                        m.rows.forEach(r => {
                            allData.push({
                                "月份": m.monthName, "日期": r.date,
                                [mNames[0] || '红章']: this.solveFormula(r.f_am),
                                [mNames[1] || '坤如']: this.solveFormula(r.m_am),
                                [mNames[2] || '姨']: this.solveFormula(r.a_am),
                                "姨支出明细(算式)": r.a_am || "0",
                                "微信": this.solveFormula(r.i1), "支付宝": this.solveFormula(r.i2), "现金": this.solveFormula(r.i3),
                                "支出小计": this.calcDaySum(r, 'expense').toFixed(2), 
                                "收入小计": this.calcDaySum(r, 'income').toFixed(2),
                                "备注说明": r.note || ""
                            });
                        });
                    });
                    const ws = XLSX.utils.json_to_sheet(allData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Financial_Backup");
                    XLSX.writeFile(wb, \`财务备份_\${new Date().toISOString().split('T')[0]}.xlsx\`);
                },

                addNewMonth() {
                    if (!this.isLoggedIn) return;
                    const n = new Date();
                    this.months.unshift({ 
                        id: 'm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6), 
                        monthName: \`\${n.getFullYear()}年\${n.getMonth()+1}月\`, 
                        memberNames: ['红章', '坤如', '姨'], 
                        rows: [], 
                        isHidden: false 
                    });
                    this.onUserEdit();
                },

                addRow(mIdx) {
                    if (!this.isLoggedIn) return;
                    const n = new Date();
                    this.months[mIdx].rows.push({ 
                        id: 'r_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6), 
                        date: \`\${n.getMonth()+1}/\${n.getDate()}\`, 
                        f_it: '', f_am: '0', f_ck: false, 
                        m_it: '', m_am: '0', m_ck: false, 
                        a_it: '', a_am: '0', a_ck: false, 
                        i1: '0', i2: '0', i3: '0', 
                        note: '' 
                    });
                    this.onUserEdit();
                },

                toggleHideMonth(mIdx) {
                    if (!this.isLoggedIn) return;
                    this.months[mIdx].isHidden = !this.months[mIdx].isHidden;
                    this.onUserEdit();
                },

                deleteMonth(mIdx) {
                    if (!this.isLoggedIn) return;
                    if (confirm(\`确定删除 "\${this.months[mIdx].monthName}" 吗？\`)) {
                        this.months.splice(mIdx, 1);
                        this.onUserEdit();
                    }
                },

                deleteRow(mIdx, rIdx) {
                    if (!this.isLoggedIn) return;
                    if (confirm('删除该行记录？')) {
                        this.months[mIdx].rows.splice(rIdx, 1);
                        this.onUserEdit();
                    }
                },

                async loadData(force = false) {
                    // 保护正在编辑态：若正在 AI 识别、弹窗开启或输入框有焦点，严禁覆盖！
                    if (!force) {
                        if (this.isAiParsing || this.batchPreviewModal.show || this.noteModal.show || this.aiSettingsModal.show) {
                            return;
                        }
                        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                            return;
                        }
                        // 如果本地有未完成同步的增量修改，坚决不被网络旧数据覆盖！
                        if (this.syncStatus === 'pending' || this.syncStatus === 'saving') {
                            return;
                        }
                    }

                    // 1. 读取本地持久镜像备用
                    let localBackup = null;
                    try {
                        const raw = localStorage.getItem('FINANCE_LOCAL_BACKUP_V5');
                        if (raw) localBackup = JSON.parse(raw);
                    } catch (_) {}

                    try {
                        const uniqueUrl = '/api/get-data?_t=' + Date.now() + '_' + Math.random().toString(36).slice(2);
                        const res = await fetch(uniqueUrl, {
                            headers: {
                                'Cache-Control': 'no-cache, no-store, must-revalidate',
                                'Pragma': 'no-cache'
                            },
                            cache: 'no-store'
                        });
                        if (!res.ok) throw new Error('拉取失败 HTTP ' + res.status);

                        const serverTimeStr = res.headers.get('X-Server-Time') || '0';
                        const serverTime = parseInt(serverTimeStr, 10) || 0;
                        const data = await res.json();

                        // 如果本地备份时间显著新于服务端记录（离线或弱网断连场景）：
                        if (localBackup && localBackup.time && localBackup.time > serverTime && Array.isArray(localBackup.months) && localBackup.months.length > 0) {
                            console.log('检测到本地有较新的离线编辑，优先装载本地并同步云端...');
                            this.isHydrating = true;
                            this.months = localBackup.months;
                            this.localModifiedTime = localBackup.time;
                            this.$nextTick(() => {
                                this.isHydrating = false;
                                this.scheduleCloudSave(100);
                            });
                            return;
                        }

                        // 正常装载云端数据，通过 isHydrating 彻底阻断自循环网络风暴
                        this.isHydrating = true;
                        this.months = (data || []).map((m, m_i) => {
                            let members = m.memberNames ? [...m.memberNames] : ['红章', '坤如', '姨'];
                            if (members.length >= 3) {
                                if (members[1] === '坤茹') members[1] = '坤如';
                                if (['烨文', '坤艳'].includes(members[2])) members[2] = '姨';
                            } else {
                                members = ['红章', '坤如', '姨'];
                            }

                            return {
                                id: m.id || ('m_' + m_i + '_' + Date.now()),
                                monthName: m.monthName,
                                memberNames: members,
                                isHidden: !!m.isHidden,
                                rows: (m.rows || []).map((r, r_i) => ({
                                    id: r.id || ('r_' + m_i + '_' + r_i + '_' + Math.random().toString(36).substr(2, 6)),
                                    date: r.date || '',
                                    f_it: r.f_it || '', f_am: r.f_am !== undefined ? r.f_am : '0', f_ck: !!r.f_ck,
                                    m_it: r.m_it || '', m_am: r.m_am !== undefined ? r.m_am : '0', m_ck: !!r.m_ck,
                                    a_it: r.a_it || '', a_am: r.a_am !== undefined ? r.a_am : '0', a_ck: !!r.a_ck,
                                    i1: r.i1 !== undefined ? r.i1 : '0',
                                    i2: r.i2 !== undefined ? r.i2 : '0',
                                    i3: r.i3 !== undefined ? r.i3 : '0',
                                    note: r.note || ''
                                }))
                            };
                        });

                        // 同步持久化一份本地副本
                        try {
                            localStorage.setItem('FINANCE_LOCAL_BACKUP_V5', JSON.stringify({
                                months: this.months,
                                time: serverTime || Date.now()
                            }));
                        } catch (_) {}

                        this.$nextTick(() => {
                            this.isHydrating = false;
                            this.syncStatus = 'synced';
                        });
                    } catch (e) {
                        console.error('Load data network error, fallback to local backup:', e);
                        if (localBackup && Array.isArray(localBackup.months) && localBackup.months.length > 0 && this.months.length === 0) {
                            this.isHydrating = true;
                            this.months = localBackup.months;
                            this.$nextTick(() => {
                                this.isHydrating = false;
                                this.syncStatus = 'offline_cached';
                            });
                        }
                    }
                },

                calcMonth(m) {
                    let inc = 0, exp = 0;
                    m.rows.forEach(r => { inc += this.calcDaySum(r, 'income'); exp += this.calcDaySum(r, 'expense'); });
                    return { income: inc, expense: exp };
                }
            },
            mounted() {
                // 1. 优先从 localStorage 恢复用户粘贴/输入的各月 AI 聊天记录，绝对不丢失
                try {
                    const cachedAiText = localStorage.getItem('FINANCE_AI_TEXT_MAP');
                    if (cachedAiText) {
                        const parsed = JSON.parse(cachedAiText);
                        if (parsed && typeof parsed === 'object') {
                            this.aiTextInputs = { ...this.aiTextInputs, ...parsed };
                        }
                    }
                } catch (_) {}

                // 2. 检查是否有未导入的 AI 批量解析结果（断点恢复）
                this.checkPendingBatchPreview();

                this.loadAiSettingsFromCloud();
                this.loadData();
                
                // 3. 页面前后台切换监听（严密防覆盖）
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') {
                        if (this.isAiParsing || this.batchPreviewModal.show || this.noteModal.show || this.aiSettingsModal.show) {
                            return;
                        }
                        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
                            return;
                        }
                        this.loadAiSettingsFromCloud();
                        this.loadData();
                    }
                });
            }
        }).mount('#app');
    </script>
</body>
</html>
  `;
}
