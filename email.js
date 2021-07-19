const nodemailer = require('nodemailer');
const Imap = require('imap');
const MailParser = require('mailparser').MailParser;
const fs = require('fs');
// 全局配置
const config = require('./config/config');

// 支持命令行模式
const [first, second, title, content] = process.argv;

// 1. 配置邮件服务器连接信息
const transporter = nodemailer.createTransport({
  service: "163",  //  邮箱
  secure: true,    //  安全的发送模式
  auth: {
      user: config.from, 
      pass: config.fromAuth
  }
});

// 2. 配置邮件选项
const mailOptions = {
  from: config.from,
  to: config.to,
  subject: "rss-title",
  text: "rss-content"
};

// 3. 发送
const sendEmail = (title, content) => {
  // 配置邮件标题和内容
  mailOptions.subject = title;
  mailOptions.text = content;

  transporter.sendMail(mailOptions, (err,data) => {
    if(err){
        console.log('发送失败', err);
        res.json({ status:400, msg:"send fail....." });
    }else{
        const  { envelope } = data;
  
        console.log(`【${envelope.from}】发给【${envelope.to[0]}】的邮件成功`);
        res.json({ status:200, msg:"send success....." });
    }
  });    
};

// 4. 接收
const receiveEmail = () => {
  const imap = new Imap({
    user: config.from, //你的邮箱账号
    password: config.fromAuth, //你的邮箱密码
    host: 'imap.163.com', //邮箱服务器的主机地址
    port: 993, //邮箱服务器的端口地址
    tls: true, //使用安全传输协议
    tlsOptions: { rejectUnauthorized: false } //禁用对证书有效性的检查
  });
  
  function openInbox(cb) {
    imap.openBox('INBOX', true, cb);
  }
  
  imap.once('ready', function() {
    openInbox(function(err, box) {
        console.log("打开邮箱")
        if (err) throw err;
        imap.search(['UNSEEN', ['SINCE', 'May 20, 2017']], function(err, results) {//搜寻2017-05-20以后未读的邮件
            if (err) throw err;
            const f = imap.fetch(results, { bodies: '' });//抓取邮件（默认情况下邮件服务器的邮件是未读状态）
            f.on('message', function(msg, seqno) {
                const mailparser = new MailParser();
  
                msg.on('body', function(stream, info) {
                    stream.pipe(mailparser);//将为解析的数据流pipe到mailparser
                    //邮件头内容
                    mailparser.on("headers", function(headers) {
                        console.log("邮件头信息>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
                        console.log("邮件主题: " + headers.get('subject'));
                        console.log("发件人: " + headers.get('from').text);
                        console.log("收件人: " + headers.get('to').text);
                    });
                    //邮件内容                 
                    mailparser.on("data", function(data) {
                        if (data.type === 'text') {//邮件正文
                            console.log("邮件内容信息>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
                            console.log("邮件内容: " + data.html);
                        }
                        if (data.type === 'attachment') {//附件
                            console.log("邮件附件信息>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
                            console.log("附件名称:"+data.filename);//打印附件的名称
                            // data.content.pipe(fs.createWriteStream(data.filename));//保存附件到当前目录下
                            data.release();
                        }
                    });
                });
  
                msg.once('end', function() {
                    console.log(seqno + '完成');
                });
            });
  
            f.once('error', function(err) {
                console.log('抓取出现错误: ' + err);
            });
  
            f.once('end', function() {
                console.log('所有邮件抓取完成!');
                imap.end();
            });
        });
    });
  });
  
  imap.once('error', function(err) {
    console.log('imap error:', err);
  });
  
  imap.once('end', function() {
    console.log('关闭邮箱');
  });
  imap.connect();
  imap.id({"name": "IMAPClient", "version": "2.1.0"}, () => {});

};

// receiveEmail();

module.exports = sendEmail;
