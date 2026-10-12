const $=id=>document.getElementById(id);
const messagesEl=$("messages"),startersEl=$("starters"),inputEl=$("input"),sendBtn=$("sendBtn"),keyModal=$("keyModal"),keyInput=$("keyInput"),rememberBox=$("rememberBox"),keyStatus=$("keyStatus"),sidebarEl=$("sidebar"),backdropEl=$("backdrop"),chatListEl=$("chatList"),historyNote=$("historyNote");
let chats=[],current=null,isBusy=false;
const CK="kinetix_chats_v1",KK="gemini_api_key";
document.documentElement.style.setProperty("--accent",BOT_CONFIG.themeColor);
document.title=BOT_CONFIG.name;
$("botName").textContent=BOT_CONFIG.name;$("botEmoji").textContent=BOT_CONFIG.emoji;$("botTagline").textContent=BOT_CONFIG.tagline;

/* API key storage */
function getKey(){try{const k=sessionStorage.getItem(KK);if(k)return k}catch(e){}try{const k=localStorage.getItem(KK);if(k)return k}catch(e){}return""}
function saveKey(key,remember){let ok=true;try{sessionStorage.setItem(KK,key)}catch(e){ok=false}try{remember?localStorage.setItem(KK,key):localStorage.removeItem(KK)}catch(e){if(remember)ok=false}return ok}
function removeKey(){try{sessionStorage.removeItem(KK)}catch(e){}try{localStorage.removeItem(KK)}catch(e){}}
function openKeyModal(msg){keyInput.value=getKey();let r=false;try{r=!!localStorage.getItem(KK)}catch(e){}rememberBox.checked=r;keyStatus.textContent=msg||"";keyModal.classList.remove("hidden");keyInput.focus()}
const closeKeyModal=()=>keyModal.classList.add("hidden");
$("apiKeyBtn").onclick=()=>openKeyModal();
$("keyCancel").onclick=closeKeyModal;
keyModal.onclick=e=>{if(e.target===keyModal)closeKeyModal()};
$("keySave").onclick=()=>{const k=keyInput.value.trim();if(!k){keyStatus.textContent="Please paste your key first.";return}if(!saveKey(k,rememberBox.checked))keyStatus.textContent="Your browser blocked saving. The key will work until you close this page.";closeKeyModal()};
$("keyClear").onclick=()=>{removeKey();keyInput.value="";keyStatus.textContent="Key removed."};

/* Saving and loading chats */
const warn=()=>{historyNote.textContent="Your browser is blocking saving, so chats won't be kept after you close this page."};
function loadChats(){try{const raw=localStorage.getItem(CK),d=raw?JSON.parse(raw):[];return Array.isArray(d)?d.filter(c=>c&&c.id&&Array.isArray(c.messages)):[]}catch(e){warn();return[]}}
function persist(){try{localStorage.setItem(CK,JSON.stringify(chats))}catch(e){warn()}}
const makeChat=()=>({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),title:"",updated:Date.now(),messages:[]});
function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}

/* Sidebar */
const openSidebar=()=>{sidebarEl.classList.add("open");backdropEl.classList.add("show")};
const closeSidebar=()=>{sidebarEl.classList.remove("open");backdropEl.classList.remove("show")};
$("menuBtn").onclick=openSidebar;backdropEl.onclick=closeSidebar;
const fmtDate=t=>{const d=new Date(t);return d.toLocaleDateString(undefined,{month:"short",day:"numeric"})+", "+d.toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})};
function renderSidebar(){
chatListEl.innerHTML="";
if(!chats.length){chatListEl.appendChild(el("p","empty-note","No saved chats yet. Start chatting and they will show up here."));return}
[...chats].sort((a,b)=>b.updated-a.updated).forEach(chat=>{
const row=el("div","chat-item"+(current&&chat.id===current.id?" active":""));
const open=el("button","chat-open");open.type="button";
open.append(el("span","chat-title",chat.title||"New chat"),el("span","chat-date",fmtDate(chat.updated)));
open.onclick=()=>openChat(chat.id);
const del=el("button","chat-delete","✕");del.type="button";del.setAttribute("aria-label","Delete this chat");del.onclick=()=>deleteChat(chat.id);
row.append(open,del);chatListEl.appendChild(row)})}
function openChat(id){if(isBusy)return;const f=chats.find(c=>c.id===id);if(!f)return;current=f;renderChat();renderSidebar();closeSidebar()}
function deleteChat(id){if(isBusy||!confirm("Delete this chat? This can't be undone."))return;chats=chats.filter(c=>c.id!==id);persist();if(current&&current.id===id){current=makeChat();renderChat()}renderSidebar()}
$("clearAllBtn").onclick=()=>{if(isBusy||!chats.length||!confirm("Delete ALL saved chats? This can't be undone."))return;chats=[];persist();current=makeChat();renderChat();renderSidebar();closeSidebar()};

/* Safe formatting (bold + bullets) */
const esc=t=>t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const inline=t=>t.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
function formatText(text){let html="",inList=false;for(const line of esc(text).split("\n")){const b=line.match(/^\s*[*\-•]\s+(.*)$/);if(b){if(!inList){html+="<ul>";inList=true}html+="<li>"+inline(b[1])+"</li>"}else{if(inList){html+="</ul>";inList=false}if(line.trim())html+="<p>"+inline(line)+"</p>"}}return inList?html+"</ul>":html}

/* Chat bubbles */
const scrollDown=()=>{messagesEl.scrollTop=messagesEl.scrollHeight};
function addBubble(type,text){const d=el("div","bubble "+type);if(type==="bot")d.innerHTML=formatText(text);else d.textContent=text;messagesEl.appendChild(d);scrollDown()}
function showThinking(){const d=el("div","bubble bot thinking");d.id="thinkingBubble";d.innerHTML="<span></span><span></span><span></span>";messagesEl.appendChild(d);scrollDown()}
function hideThinking(){const e=$("thinkingBubble");if(e)e.remove()}
function renderChat(){messagesEl.innerHTML="";addBubble("bot",BOT_CONFIG.welcomeMessage);current.messages.forEach(m=>m.role==="user"?addBubble("user",m.shown||m.text):addBubble("bot",m.text));if(current.messages.length){startersEl.classList.add("hidden")}else{buildStarters();startersEl.classList.remove("hidden")}}

/* Friendly errors */
function friendlyError(s){if(s===400||s===403)return'Your API key doesn\'t seem to work. Click the "API key" button and check that you pasted it correctly.';if(s===404)return"I couldn't find that AI model. Check the model name in config.js.";if(s===429)return"Too many requests right now. Please wait a minute and try again.";if(s>=500)return"Google's AI service is having problems. Please try again in a little while.";return"Something went wrong (error "+s+"). Please try again."}

/* Talking to Gemini */
async function askGemini(){
const url="https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(BOT_CONFIG.model)+":generateContent";
const res=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":getKey()},body:JSON.stringify({systemInstruction:{parts:[{text:BOT_CONFIG.systemInstructions}]},contents:current.messages.map(m=>({role:m.role,parts:[{text:m.text}]}))})});
if(!res.ok){const e=new Error("HTTP error");e.status=res.status;throw e}
const data=await res.json();
const parts=(data.candidates&&data.candidates[0]&&data.candidates[0].content&&data.candidates[0].content.parts)||[];
return parts.filter(p=>p.text&&p.thought!==true).map(p=>p.text).join("")}

/* Sending a message */
async function sendMessage(shownText,sentText){
if(isBusy)return;const shown=(shownText||"").trim();if(!shown)return;
if(!getKey()){openKeyModal("Please paste your Gemini API key to start chatting.");return}
isBusy=true;sendBtn.disabled=true;startersEl.classList.add("hidden");
if(!current.title)current.title=shown.length>40?shown.slice(0,40)+"…":shown;
addBubble("user",shown);current.messages.push({role:"user",text:sentText||shown,shown});showThinking();
const undo=()=>{current.messages.pop();if(!current.messages.length)current.title=""};
try{const reply=await askGemini();hideThinking();
if(!reply){undo();addBubble("error","I didn't get an answer that time. Please try sending your message again.")}
else{current.messages.push({role:"model",text:reply});current.updated=Date.now();addBubble("bot",reply);if(!chats.includes(current))chats.push(current);persist();renderSidebar()}
}catch(err){hideThinking();undo();addBubble("error",err.status?friendlyError(err.status):"I can't reach the internet. Check your connection and try again.")}
isBusy=false;sendBtn.disabled=false;inputEl.focus()}

/* Input box */
function autoGrow(){inputEl.style.height="auto";inputEl.style.height=Math.min(inputEl.scrollHeight,140)+"px"}
function sendFromInput(){const t=inputEl.value;inputEl.value="";autoGrow();sendMessage(t)}
inputEl.addEventListener("input",autoGrow);
inputEl.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();sendFromInput()}});
sendBtn.onclick=sendFromInput;

/* Starter buttons and new chat */
function buildStarters(){startersEl.innerHTML="";BOT_CONFIG.starterQuestions.forEach(q=>{const b=el("button","starter-btn",q);b.type="button";b.onclick=()=>sendMessage(q,"Please ask me this question in your own encouraging words, then wait for my answer: "+q);startersEl.appendChild(b)})}
function startNewChat(){if(isBusy)return;current=makeChat();renderChat();renderSidebar();closeSidebar()}
$("newChatBtn").onclick=startNewChat;$("sidebarNewBtn").onclick=startNewChat;

/* Start */
chats=loadChats();current=makeChat();renderChat();renderSidebar();
