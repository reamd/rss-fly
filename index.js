const fs = require('fs');
const axios = require('axios');
const convert = require('xml-js');
const dateFormat = require("dateformat");

const sendEmail = require('./email');
const recordJson = require('./config/record.json');
const wordArr = require('./config/words.json');
// 全局配置
const { HOST_NAME, REPEAT_TIME, robotUrl, chatid } = require('./config/config');

const [first, second, mode] = process.argv;
let lastRecordDate = '';

// 监控模式辅助函数
function getWordEmotion(word) {
  let res = '';
  for (let item of wordArr) {
    if (item.word === word) {
      res = item.emotion;
      break;
    }
  }
  return res;
}
async function getWords(txt) {
  const eArr = [];
  const { data: res } = await axios.get(`http://hn216.api.yesapi.cn/?s=App.Scws.GetWords&app_key=xxxxxxxx&return_data=1&text=${encodeURIComponent(txt)}`);
  console.log('【分词结果】', JSON.stringify(res.words));
  
  res.words.forEach(item => {
    const { word } = item;
    if (word) {
      eArr.push(getWordEmotion(word));
    }
  });
  
  // 是否包含 - 烦闷(NE) - 例子：憋闷、烦躁、心烦意乱、自寻烦恼
  return eArr.includes('NE');
}

// 万物互联-rtx机器人
async function sendWxChatsByReport(cmd) {
  const data = {};
  if(chatid) {
    data['chatid'] = chatid;
  }
  data['msgtype'] = "markdown";
  data['markdown'] = {
    "content": cmd
  };
 
  await axios({
    url: robotUrl,
    method: 'POST',
    data,
  }).catch(err => {
    console.log('axios error', err);
  })
}

async function handleRss() {
  const { data: xml } = await axios.get(`${HOST_NAME}/weibo/user/xxxxx`);
  const res = convert.xml2js(xml, {compact: true, spaces: 4});
  const items = res?.rss?.channel?.item;
  if (items.length > 0) {
    const item = items[0];
    const author = item?.author?._cdata;
    const pubDate = item?.pubDate?._text;
    const content = item?.description?._cdata;
    const contentTxt = item?.title?._cdata;

    if (lastRecordDate === pubDate) {
      console.log('\n拉取成功，无新增内容', dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss'));
    } else {
      console.log('拉取成功，正在处理新增内容', dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss'), '\n');
      fs.writeFileSync('./config/record.json', JSON.stringify({
        pubDate,
      }, null, 2));
      lastRecordDate = pubDate;

      // 继续执行
      const pubTime = dateFormat(new Date(pubDate), 'yyyy-mm-dd HH:MM:ss');

      if (mode === 'notify') {
        const wbTitle = `[${author}]在${pubTime}发了微博`;
        const wbContent = `[${author}]在${pubTime}发了微博【${content}】`;
        sendEmail(wbTitle, wbContent);
      } else if (mode === 'monitor') {
        // 分析
        console.log('微博内容', contentTxt);
        const flag = await getWords(contentTxt);
        if (flag) {
          console.log('命中情感警告');
          const wbTitle = `[${author}]处在烦闷中，在${pubTime}发了微博`;
          const wbContent = `[${author}]在${pubTime}发了微博【${content}】，该微博显示了${author}处在烦闷中`;
          sendEmail(wbTitle, wbContent);
        }
      } else if (mode === 'IOT') {
        const [ cmdStr, wxSource ] = content.split(' ');
        const wx = wxSource.trim();
        if (cmdStr === '添加权限') {
          console.log(cmdStr, wx);
          await sendWxChatsByReport(`添加权限中（微博触发）
            > 微信号${wx}`);
          axios.post('http://xxxxx',
            {
              wx,
              chatid,
              caller: ''
            },
            {
              'Content-Type': 'application/json'
            }
          ).catch(err => console.log(err));
        }

      }
    }
  }
}

function main() {
  const modeMap = {
    notify: '通知',
    monitor: '监控',
    IOT: '万物互联'
  }
  console.log(`RSS【${modeMap[mode]}】模式启动`);
  lastRecordDate = recordJson.pubDate;

  handleRss();

  setInterval(() => {
    handleRss();
  }, REPEAT_TIME);
}

main();
