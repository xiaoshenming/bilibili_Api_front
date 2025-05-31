// app.js
const express = require("express");
const cors = require("cors");
const http = require("http");
require("dotenv").config();

const { startHeartbeats } = require("./config/heartbeat");
const userRouter = require("./model/user/userRouters");
const videoRouter = require("./model/video/videoRouters"); // 【新增】导入视频路由
const bilibiliRouter = require("./model/bilibili/bilibiliRouters"); // 【新增】导入B站路由

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

// --- 中间件 ---
app.use(cors()); // 启用 CORS
app.use(express.json()); // 解析 JSON 请求体

// --- 静态文件服务 ---
// 如果您仍需要提供视频文件的直接访问，可以保留这部分
const path = require("path");
const serveIndex = require("serve-index");
const videoDir = path.join(__dirname, "video");
app.use("/video", express.static(videoDir), serveIndex(videoDir, { icons: true }));

// --- 路由 ---
app.use("/api", userRouter); // 挂载用户路由，建议添加前缀 /user
app.use("/api/video", videoRouter); // 【新增】挂载视频路由，统一前缀 /video
app.use("/api/bilibili", bilibiliRouter); // 【新增】挂载B站路由，统一前缀 /bilibili

// --- 启动服务 ---
startHeartbeats(); // 启动数据库和 Redis 的心跳检测

server.listen(port, "0.0.0.0", () => {
  console.log(`✅ 服务器已成功启动，正在监听端口：http://0.0.0.0:${port}`);
});
const express = require("express");
const router = express.Router();
const bilibiliUtils = require("./bilibiliUtils");
const authorize = require("../auth/authUtils"); // 授权中间件
const axios = require("axios");

// B站请求头
const BILIBILI_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Accept': '*/*',
  'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
  'Accept-Encoding': 'gzip, deflate',
  'Referer': 'https://www.bilibili.com/',
  'Connection': 'keep-alive'
};

// --- B站登录相关接口 ---

/**
 * 生成B站登录二维码
 * POST /api/bilibili/generate-qrcode
 * 需要用户登录
 */
router.post("/generate-qrcode", authorize(["1", "2", "3"]), async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id; // 从JWT中获取用户ID
    
    const result = await bilibiliUtils.generateBilibiliQRCode(userId);
    
    res.json({
      code: 200,
      message: "二维码生成成功",
      data: result
    });
  } catch (error) {
    console.error("生成B站二维码失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "生成二维码失败",
      data: null
    });
  }
});

/**
 * 获取B站登录状态
 * GET /api/bilibili/login-status/:sessionId
 * 需要用户登录
 */
router.get("/login-status/:sessionId", authorize(["1", "2", "3"]), async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const status = await bilibiliUtils.getBilibiliLoginStatus(sessionId);
    
    res.json({
      code: 200,
      message: "获取状态成功",
      data: status
    });
  } catch (error) {
    console.error("获取B站登录状态失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "获取状态失败",
      data: null
    });
  }
});

/**
 * 获取用户的B站账号列表
 * GET /api/bilibili/accounts
 * 需要用户登录
 */
router.get("/accounts", authorize(["1", "2", "3"]), async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    
    const accounts = await bilibiliUtils.getUserBilibiliAccounts(userId);
    
    res.json({
      code: 200,
      message: "获取账号列表成功",
      data: accounts
    });
  } catch (error) {
    console.error("获取B站账号列表失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "获取账号列表失败",
      data: null
    });
  }
});

/**
 * 切换B站账号状态
 * PUT /api/bilibili/accounts/:accountId/toggle
 * 需要用户登录
 */
router.put("/accounts/:accountId/toggle", authorize(["1", "2", "3"]), async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    const { accountId } = req.params;
    const { isActive } = req.body;
    
    await bilibiliUtils.toggleBilibiliAccountStatus(userId, accountId, isActive);
    
    res.json({
      code: 200,
      message: "账号状态更新成功",
      data: null
    });
  } catch (error) {
    console.error("切换B站账号状态失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "状态更新失败",
      data: null
    });
  }
});

/**
 * 删除B站账号
 * DELETE /api/bilibili/accounts/:accountId
 * 需要用户登录
 */
router.delete("/accounts/:accountId", authorize(["1", "2", "3"]), async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    const { accountId } = req.params;
    
    await bilibiliUtils.deleteBilibiliAccount(userId, accountId);
    
    res.json({
      code: 200,
      message: "账号删除成功",
      data: null
    });
  } catch (error) {
    console.error("删除B站账号失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "删除账号失败",
      data: null
    });
  }
});

// --- B站视频解析相关接口 ---

/**
 * 解析B站视频信息
 * GET /api/bilibili/parse-video
 * 需要用户登录，使用用户的B站账号
 */
router.get("/parse-video", authorize(["1", "2", "3"]), async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    const { input } = req.query;
    
    if (!input) {
      return res.status(400).json({
        code: 400,
        message: "输入不能为空",
        data: null
      });
    }
    
    // 获取用户的活跃B站账号
    const bilibiliAccount = await bilibiliUtils.getActiveBilibiliAccount(userId);
    if (!bilibiliAccount) {
      return res.status(400).json({
        code: 400,
        message: "请先登录B站账号",
        data: null
      });
    }
    
    // 提取BVID
    const bvid = extractBvid(input);
    if (!bvid) {
      return res.status(400).json({
        code: 400,
        message: "无法解析BVID",
        data: null
      });
    }
    
    // 获取视频信息
    const videoInfo = await getVideoInfo(bvid, bilibiliAccount.cookie_string);
    if (!videoInfo) {
      return res.status(400).json({
        code: 400,
        message: "未能解析视频信息",
        data: null
      });
    }
    
    // 获取播放信息
    const playInfo = await getPlayInfo(bvid, videoInfo.cid, bilibiliAccount.cookie_string);
    if (!playInfo) {
      return res.status(500).json({
        code: 500,
        message: "无法获取播放信息",
        data: null
      });
    }
    
    res.json({
      code: 200,
      message: "解析成功",
      data: {
        bvid: videoInfo.bvid,
        cid: videoInfo.cid,
        title: videoInfo.title,
        desc: videoInfo.desc,
        type: videoInfo.tname,
        play_info: playInfo
      }
    });
    
  } catch (error) {
    console.error("解析B站视频失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "解析视频失败",
      data: null
    });
  }
});

/**
 * 解析B站视频详细信息（包含下载链接）
 * GET /api/bilibili/parse-videos
 * 需要用户登录，使用用户的B站账号
 */
router.get("/parse-videos", authorize(["1", "2", "3"]), async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    const { input } = req.query;
    
    if (!input) {
      return res.status(400).json({
        code: 400,
        message: "输入不能为空",
        data: null
      });
    }
    
    // 获取用户的活跃B站账号
    const bilibiliAccount = await bilibiliUtils.getActiveBilibiliAccount(userId);
    if (!bilibiliAccount) {
      return res.status(400).json({
        code: 400,
        message: "请先登录B站账号",
        data: null
      });
    }
    
    // 提取BVID
    const bvid = extractBvid(input);
    if (!bvid) {
      return res.status(400).json({
        code: 400,
        message: "无法解析BVID",
        data: null
      });
    }
    
    // 获取视频信息
    const videoInfo = await getVideoInfo(bvid, bilibiliAccount.cookie_string);
    if (!videoInfo) {
      return res.status(400).json({
        code: 400,
        message: "未能解析视频信息",
        data: null
      });
    }
    
    // 获取播放信息
    const playInfo = await getPlayInfo(bvid, videoInfo.cid, bilibiliAccount.cookie_string);
    if (!playInfo) {
      return res.status(500).json({
        code: 500,
        message: "无法获取播放信息",
        data: null
      });
    }
    
    res.json({
      code: 200,
      message: "解析成功",
      data: {
        videoUrl: playInfo.dash?.video?.[0]?.backupUrl?.[0] || playInfo.dash?.video?.[0]?.baseUrl,
        audioUrl: playInfo.dash?.audio?.[0]?.backupUrl?.[0] || playInfo.dash?.audio?.[0]?.baseUrl,
        bvid: videoInfo.bvid,
        aid: videoInfo.aid,
        cid: videoInfo.cid,
        tname: videoInfo.tname,
        pic: videoInfo.pic,
        title: videoInfo.title,
        desc: videoInfo.desc,
        duration: videoInfo.duration,
        pubdate: videoInfo.pubdate,
        name: videoInfo.owner?.name,
        face: videoInfo.owner?.face,
        view: videoInfo.stat?.view,
        danmaku: videoInfo.stat?.danmaku,
        reply: videoInfo.stat?.reply,
        favorite: videoInfo.stat?.favorite,
        coin: videoInfo.stat?.coin,
        share: videoInfo.stat?.share,
        like: videoInfo.stat?.like
      }
    });
    
  } catch (error) {
    console.error("解析B站视频详情失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "解析视频失败",
      data: null
    });
  }
});

/**
 * 下载B站视频
 * GET /api/bilibili/download
 * 需要用户登录，使用用户的B站账号
 */
router.get("/download", authorize(["1", "2", "3"]), async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    const { bvid, cid, quality = 80 } = req.query;
    
    if (!bvid || !cid) {
      return res.status(400).json({
        code: 400,
        message: "缺少必要参数 bvid 或 cid",
        data: null
      });
    }
    
    // 获取用户的活跃B站账号
    const bilibiliAccount = await bilibiliUtils.getActiveBilibiliAccount(userId);
    if (!bilibiliAccount) {
      return res.status(400).json({
        code: 400,
        message: "请先登录B站账号",
        data: null
      });
    }
    
    // 获取播放信息
    const playInfo = await getPlayInfo(bvid, cid, bilibiliAccount.cookie_string);
    if (!playInfo) {
      return res.status(500).json({
        code: 500,
        message: "无法获取播放信息",
        data: null
      });
    }
    
    let videoUrl = null;
    const audioUrl = playInfo.dash?.audio?.[0]?.baseUrl;
    
    // 根据清晰度选择视频URL
    for (const video of playInfo.dash?.video || []) {
      if (video.id == quality) {
        videoUrl = video.baseUrl;
        break;
      }
    }
    
    // 如果没找到指定清晰度，使用第一个
    if (!videoUrl && playInfo.dash?.video?.length > 0) {
      videoUrl = playInfo.dash.video[0].baseUrl;
    }
    
    if (!videoUrl || !audioUrl) {
      return res.status(500).json({
        code: 500,
        message: "未找到视频或音频下载地址",
        data: null
      });
    }
    
    res.json({
      code: 200,
      message: "获取下载链接成功",
      data: {
        videoUrl,
        audioUrl,
        bvid,
        cid,
        quality
      }
    });
    
  } catch (error) {
    console.error("获取下载链接失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "获取下载链接失败",
      data: null
    });
  }
});

// --- 辅助函数 ---

/**
 * 提取BVID
 * @param {string} input - 用户输入
 * @returns {string|null} BVID
 */
function extractBvid(input) {
  if (input.startsWith("https://www.bilibili.com/video/")) {
    const startIdx = input.indexOf("BV");
    const endIdx = input.indexOf("?", startIdx);
    if (endIdx === -1) {
      return input.substring(startIdx);
    }
    return input.substring(startIdx, endIdx);
  } else if (input.startsWith("BV")) {
    return input;
  }
  return null;
}

/**
 * 获取视频信息
 * @param {string} bvid - BVID
 * @param {string} cookieString - Cookie字符串
 * @returns {Object|null} 视频信息
 */
async function getVideoInfo(bvid, cookieString) {
  try {
    const response = await axios.get(
      `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
      {
        headers: {
          ...BILIBILI_HEADERS,
          'Cookie': cookieString
        }
      }
    );
    
    if (response.data && response.data.code === 0) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.error('获取视频信息失败:', error);
    return null;
  }
}

/**
 * 获取播放信息
 * @param {string} bvid - BVID
 * @param {string} cid - CID
 * @param {string} cookieString - Cookie字符串
 * @returns {Object|null} 播放信息
 */
async function getPlayInfo(bvid, cid, cookieString) {
  try {
    const response = await axios.get(
      `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&fnval=4048&fnver=0&fourk=1`,
      {
        headers: {
          ...BILIBILI_HEADERS,
          'Cookie': cookieString
        }
      }
    );
    
    if (response.data && response.data.code === 0) {
      return response.data.data;
    }
    return null;
  } catch (error) {
    console.error('获取播放信息失败:', error);
    return null;
  }
}

module.exports = router;
const db = require("../../config/db");
const redis = require("../../config/redis");
const axios = require("axios");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");

// B站请求头
const BILIBILI_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Accept': '*/*',
  'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
  'Accept-Encoding': 'gzip, deflate',
  'Referer': 'https://www.bilibili.com/',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Priority': 'u=1',
  'TE': 'trailers'
};

/**
 * 生成B站登录二维码
 * @param {number} userId - 用户ID
 * @returns {Object} 包含二维码key和图片base64的对象
 */
async function generateBilibiliQRCode(userId) {
  try {
    // 调用B站API生成二维码
    const response = await axios.get(
      'https://passport.bilibili.com/x/passport-login/web/qrcode/generate?source=main_web',
      { headers: BILIBILI_HEADERS }
    );

    if (response.data && response.data.code === 0) {
      const { url, qrcode_key } = response.data.data;
      
      // 生成唯一的会话ID
      const sessionId = uuidv4();
      
      // 将二维码信息存储到Redis，设置10分钟过期
      await redis.setex(`bilibili_qr_${sessionId}`, 600, JSON.stringify({
        userId,
        qrcode_key,
        url,
        status: 'waiting',
        created_at: new Date().toISOString()
      }));

      // 生成二维码图片
      const qrCodeDataURL = await QRCode.toDataURL(url);
      
      // 启动轮询检查登录状态
      pollBilibiliLoginStatus(sessionId, qrcode_key);
      
      return {
        sessionId,
        qrcode_key,
        qrCodeImage: qrCodeDataURL,
        status: 'waiting'
      };
    } else {
      throw new Error('生成二维码失败');
    }
  } catch (error) {
    console.error('生成B站二维码失败:', error);
    throw new Error('生成二维码失败: ' + error.message);
  }
}

/**
 * 轮询检查B站登录状态
 * @param {string} sessionId - 会话ID
 * @param {string} qrcode_key - 二维码key
 */
async function pollBilibiliLoginStatus(sessionId, qrcode_key) {
  const maxAttempts = 120; // 最多轮询2分钟
  let attempts = 0;
  
  const poll = async () => {
    try {
      attempts++;
      
      // 检查会话是否还存在
      const sessionData = await redis.get(`bilibili_qr_${sessionId}`);
      if (!sessionData) {
        console.log(`会话 ${sessionId} 已过期或不存在`);
        return;
      }
      
      const session = JSON.parse(sessionData);
      
      // 调用B站API检查登录状态
      const response = await axios.get(
        `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${qrcode_key}&source=navUserCenterLogin`,
        { headers: BILIBILI_HEADERS }
      );
      
      if (response.data && response.data.data) {
        const { code, url, message } = response.data.data;
        
        if (code === 0 && url) {
          // 登录成功，获取cookie
          await handleSuccessfulLogin(sessionId, session.userId, url);
          return;
        } else if (code === 86038) {
          // 二维码已过期
          await updateSessionStatus(sessionId, 'expired', '二维码已过期');
          return;
        } else if (code === 86101) {
          // 未扫码
          await updateSessionStatus(sessionId, 'waiting', '等待扫码');
        } else if (code === 86090) {
          // 已扫码，等待确认
          await updateSessionStatus(sessionId, 'scanned', '已扫码，等待确认');
        }
      }
      
      // 继续轮询
      if (attempts < maxAttempts) {
        setTimeout(poll, 1000); // 1秒后再次检查
      } else {
        await updateSessionStatus(sessionId, 'timeout', '登录超时');
      }
    } catch (error) {
      console.error('轮询B站登录状态失败:', error);
      if (attempts < maxAttempts) {
        setTimeout(poll, 2000); // 出错时2秒后重试
      }
    }
  };
  
  poll();
}

/**
 * 处理登录成功
 * @param {string} sessionId - 会话ID
 * @param {number} userId - 用户ID
 * @param {string} loginUrl - 登录URL
 */
async function handleSuccessfulLogin(sessionId, userId, loginUrl) {
  try {
    // 访问登录URL获取cookie
    const response = await axios.get(loginUrl, {
      headers: BILIBILI_HEADERS,
      maxRedirects: 5
    });
    
    const cookies = response.headers['set-cookie'];
    if (!cookies) {
      throw new Error('未获取到登录cookie');
    }
    
    // 解析cookie
    const cookieObj = {};
    let cookieString = '';
    
    cookies.forEach(cookie => {
      const parts = cookie.split(';')[0].split('=');
      if (parts.length === 2) {
        cookieObj[parts[0]] = parts[1];
        cookieString += `${parts[0]}=${parts[1]}; `;
      }
    });
    
    const dedeuserid = cookieObj.DedeUserID;
    const bili_jct = cookieObj.bili_jct;
    
    if (!dedeuserid || !bili_jct) {
      throw new Error('登录cookie不完整');
    }
    
    // 获取用户信息
    const userInfo = await getBilibiliUserInfo(dedeuserid, cookieString);
    
    // 保存到数据库
    await saveBilibiliAccount({
      userId,
      dedeuserid,
      bili_jct,
      cookieString: cookieString.trim(),
      nickname: userInfo.nickname,
      avatar: userInfo.avatar
    });
    
    // 更新会话状态
    await updateSessionStatus(sessionId, 'success', '登录成功', {
      dedeuserid,
      nickname: userInfo.nickname,
      avatar: userInfo.avatar
    });
    
  } catch (error) {
    console.error('处理登录成功失败:', error);
    await updateSessionStatus(sessionId, 'error', '登录处理失败: ' + error.message);
  }
}

/**
 * 获取B站用户信息
 * @param {string} dedeuserid - B站用户ID
 * @param {string} cookieString - Cookie字符串
 * @returns {Object} 用户信息
 */
async function getBilibiliUserInfo(dedeuserid, cookieString) {
  try {
    const response = await axios.get(
      `https://api.bilibili.com/x/space/acc/info?mid=${dedeuserid}`,
      {
        headers: {
          ...BILIBILI_HEADERS,
          'Cookie': cookieString
        }
      }
    );
    
    if (response.data && response.data.code === 0) {
      const data = response.data.data;
      return {
        nickname: data.name || '未知用户',
        avatar: data.face || ''
      };
    } else {
      return {
        nickname: '未知用户',
        avatar: ''
      };
    }
  } catch (error) {
    console.error('获取B站用户信息失败:', error);
    return {
      nickname: '未知用户',
      avatar: ''
    };
  }
}

/**
 * 保存B站账号信息到数据库
 * @param {Object} accountData - 账号数据
 */
async function saveBilibiliAccount(accountData) {
  const connection = await db.promise().getConnection();
  
  try {
    await connection.beginTransaction();
    
    // 检查是否已存在该B站账号
    const [existing] = await connection.query(
      'SELECT id FROM bilibili_accounts WHERE user_id = ? AND dedeuserid = ?',
      [accountData.userId, accountData.dedeuserid]
    );
    
    if (existing.length > 0) {
      // 更新现有记录
      await connection.query(
        `UPDATE bilibili_accounts SET 
         bili_jct = ?, cookie_string = ?, nickname = ?, avatar = ?, 
         is_active = 1, login_time = NOW(), updated_at = NOW()
         WHERE user_id = ? AND dedeuserid = ?`,
        [
          accountData.bili_jct,
          accountData.cookieString,
          accountData.nickname,
          accountData.avatar,
          accountData.userId,
          accountData.dedeuserid
        ]
      );
    } else {
      // 插入新记录
      await connection.query(
        `INSERT INTO bilibili_accounts 
         (user_id, dedeuserid, bili_jct, cookie_string, nickname, avatar, login_time)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          accountData.userId,
          accountData.dedeuserid,
          accountData.bili_jct,
          accountData.cookieString,
          accountData.nickname,
          accountData.avatar
        ]
      );
    }
    
    await connection.commit();
    console.log(`B站账号保存成功: 用户${accountData.userId} - ${accountData.nickname}`);
    
  } catch (error) {
    await connection.rollback();
    console.error('保存B站账号失败:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 更新会话状态
 * @param {string} sessionId - 会话ID
 * @param {string} status - 状态
 * @param {string} message - 消息
 * @param {Object} data - 额外数据
 */
async function updateSessionStatus(sessionId, status, message, data = {}) {
  try {
    const sessionData = await redis.get(`bilibili_qr_${sessionId}`);
    if (sessionData) {
      const session = JSON.parse(sessionData);
      session.status = status;
      session.message = message;
      session.data = data;
      session.updated_at = new Date().toISOString();
      
      await redis.setex(`bilibili_qr_${sessionId}`, 600, JSON.stringify(session));
    }
  } catch (error) {
    console.error('更新会话状态失败:', error);
  }
}

/**
 * 获取登录状态
 * @param {string} sessionId - 会话ID
 * @returns {Object} 登录状态
 */
async function getBilibiliLoginStatus(sessionId) {
  try {
    const sessionData = await redis.get(`bilibili_qr_${sessionId}`);
    if (!sessionData) {
      return { status: 'expired', message: '会话已过期' };
    }
    
    const session = JSON.parse(sessionData);
    return {
      status: session.status,
      message: session.message,
      data: session.data || {}
    };
  } catch (error) {
    console.error('获取登录状态失败:', error);
    return { status: 'error', message: '获取状态失败' };
  }
}

/**
 * 获取用户的B站账号列表
 * @param {number} userId - 用户ID
 * @returns {Array} B站账号列表
 */
async function getUserBilibiliAccounts(userId) {
  try {
    const [accounts] = await db.promise().query(
      `SELECT id, dedeuserid, nickname, avatar, is_active, login_time, created_at
       FROM bilibili_accounts 
       WHERE user_id = ? 
       ORDER BY login_time DESC`,
      [userId]
    );
    
    return accounts;
  } catch (error) {
    console.error('获取用户B站账号失败:', error);
    throw error;
  }
}

/**
 * 获取用户的活跃B站账号
 * @param {number} userId - 用户ID
 * @returns {Object|null} 活跃的B站账号
 */
async function getActiveBilibiliAccount(userId) {
  try {
    const [accounts] = await db.promise().query(
      `SELECT * FROM bilibili_accounts 
       WHERE user_id = ? AND is_active = 1 
       ORDER BY login_time DESC 
       LIMIT 1`,
      [userId]
    );
    
    return accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    console.error('获取活跃B站账号失败:', error);
    throw error;
  }
}

/**
 * 切换B站账号状态
 * @param {number} userId - 用户ID
 * @param {number} accountId - 账号ID
 * @param {boolean} isActive - 是否激活
 */
async function toggleBilibiliAccountStatus(userId, accountId, isActive) {
  try {
    await db.promise().query(
      'UPDATE bilibili_accounts SET is_active = ? WHERE id = ? AND user_id = ?',
      [isActive ? 1 : 0, accountId, userId]
    );
  } catch (error) {
    console.error('切换B站账号状态失败:', error);
    throw error;
  }
}

/**
 * 删除B站账号
 * @param {number} userId - 用户ID
 * @param {number} accountId - 账号ID
 */
async function deleteBilibiliAccount(userId, accountId) {
  try {
    await db.promise().query(
      'DELETE FROM bilibili_accounts WHERE id = ? AND user_id = ?',
      [accountId, userId]
    );
  } catch (error) {
    console.error('删除B站账号失败:', error);
    throw error;
  }
}

/**
 * 验证B站Cookie是否有效
 * @param {string} cookieString - Cookie字符串
 * @returns {boolean} 是否有效
 */
async function validateBilibiliCookie(cookieString) {
  try {
    const response = await axios.get(
      'https://api.bilibili.com/x/web-interface/nav',
      {
        headers: {
          ...BILIBILI_HEADERS,
          'Cookie': cookieString
        }
      }
    );
    
    return response.data && response.data.code === 0 && response.data.data.isLogin;
  } catch (error) {
    console.error('验证B站Cookie失败:', error);
    return false;
  }
}

module.exports = {
  generateBilibiliQRCode,
  getBilibiliLoginStatus,
  getUserBilibiliAccounts,
  getActiveBilibiliAccount,
  toggleBilibiliAccountStatus,
  deleteBilibiliAccount,
  validateBilibiliCookie
};
// model/video/videoRouters.js

const express = require("express");
const router = express.Router();
const videoUtils = require("./videoUtils");
const authorize = require("../auth/authUtils"); // 导入授权中间件

/**
 * @api {get} /api/video/list
 * @description 获取所有已处理的视频列表
 * @access Public
 */
router.get("/list", async (req, res) => {
  try {
    const videos = await videoUtils.listAllVideos();
    res.status(200).json({
      code: 200,
      message: "成功获取视频列表",
      data: videos,
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message || "获取视频列表失败",
      data: null,
    });
  }
});

/**
 * @api {post} /api/video/process
 * @description 提交一个 Bilibili 视频 URL 进行处理（爬取、下载、合并、入库）
 * @access Protected - 需要用户登录
 * @body { "url": "视频的URL或BVID" }
 */
router.post("/process", authorize(["1", "2", "3"]), async (req, res) => {
  const { url } = req.body;
  if (!url || !url.trim()) {
    return res.status(400).json({
      code: 400,
      message: "请提供有效的视频 URL",
      data: null,
    });
  }

  try {
    // processVideoRequest 是一个长时任务，但我们在这里等待它完成
    // 对于生产环境，可以考虑使用任务队列（如 BullMQ）来处理，并立即返回一个任务ID
    console.log(`▶️ 开始处理视频请求: ${url}`);
    const result = await videoUtils.processVideoRequest(url);
    console.log(`✅ 视频处理完成: ${result.title}`);
    res.status(201).json({
      code: 201,
      message: "视频处理成功并已入库",
      data: result,
    });
  } catch (error) {
    console.error(`❌ 处理视频 ${url} 时发生致命错误:`, error);
    res.status(500).json({
      code: 500,
      message: error.message || "处理视频时发生未知错误",
      data: null,
    });
  }
});

module.exports = router;
// model/video/videoUtils.js

const db = require("../../config/db").promise(); // 【复用】导入并使用 promise 版本的数据库连接池
const axios = require("axios");
const fs = require("fs").promises; // 使用 promise 版本的 fs 模块
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

// 从环境变量中获取配置
const FFMPEG_PATH = process.env.FFMPEG_PATH;
const FLASK_API_BASE_URL =
  process.env.FLASK_API_BASE_URL || "http://127.0.0.1:7893"; // 建议将 Flask 地址也放入 .env
const SERVER_HOST = process.env.SERVER_HOST || "10.3.36.36"; // 服务器公网 IP 或域名
const PORT = process.env.PORT || 3000;

// 设置 ffmpeg 路径
if (FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(FFMPEG_PATH);
} else {
  console.warn(
    "⚠️ 未在 .env 文件中配置 FFmpeg_PATH 路径，合并功能可能无法使用。"
  );
}

const downloadDir = path.join(__dirname, "..", "..", "download"); // 临时下载文件夹
const videoDir = path.join(__dirname, "..", "..", "video"); // 最终视频输出文件夹

/**
 * @description 调用 Flask API 爬取 Bilibili 视频的详细信息。
 * @param {string} url - Bilibili 视频的 URL 或 BVID。
 * @returns {Promise<object>} - 包含视频详细信息的对象。
 */
async function scrapeBilibiliVideo(url) {
  try {
    console.log(`[1/4] 正在从 Flask API 爬取视频信息: ${url}`);
    const response = await axios.get(`${FLASK_API_BASE_URL}/parse_videos`, {
      params: { input: url },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      },
    });

    if (response.status !== 200 || !response.data) {
      throw new Error(`Flask API 响应异常，状态码：${response.status}`);
    }

    console.log(`[1/4] ✔️ 视频信息爬取成功: ${response.data.title}`);
    return response.data;
  } catch (error) {
    console.error("❌ 爬取 Bilibili 视频信息失败:", error.message);
    throw new Error("爬取视频信息失败，请检查视频链接或稍后再试。");
  }
}

/**
 * @description 调用 Flask API 下载视频和音频文件到临时目录。
 * @param {string} bvid - 视频的 BVID。
 * @param {string} cid - 视频的 CID。
 * @returns {Promise<{videoFilePath: string, audioFilePath: string}>} - 包含视频和音频文件路径的对象。
 */
async function downloadFiles(bvid, cid) {
  try {
    console.log(`[2/4] 正在请求 Flask API 下载视频和音频... (BVID: ${bvid})`);
    // 确保临时目录和最终目录存在
    await fs.mkdir(downloadDir, { recursive: true });
    await fs.mkdir(videoDir, { recursive: true });

    const response = await axios.get(`${FLASK_API_BASE_URL}/download`, {
      params: { bvid, cid, quality: 80 }, // quality 可以作为参数传递
    });

    const { video_file, audio_file, message } = response.data;
    if (message !== "下载成功" || !video_file || !audio_file) {
      throw new Error(`Flask API 下载失败: ${message}`);
    }

    // 注意：这里的逻辑假设 Flask 将文件下载到了 Node.js 可以访问的共享目录 `downloadDir` 中
    const videoFilePath = path.join(downloadDir, video_file);
    const audioFilePath = path.join(downloadDir, audio_file);

    // 检查文件是否真的存在
    await fs.access(videoFilePath);
    await fs.access(audioFilePath);

    console.log(`[2/4] ✔️ 文件下载成功: ${video_file}, ${audio_file}`);
    return { videoFilePath, audioFilePath };
  } catch (error) {
    console.error("❌ 调用 Flask API 下载文件失败:", error.message);
    throw new Error("下载视频源文件失败，可能是后端服务异常。");
  }
}

/**
 * @description 使用 FFmpeg 合并视频和音频文件。
 * @param {string} videoFilePath - 视频文件路径。
 * @param {string} audioFilePath - 音频文件路径。
 * @param {string} outputFilePath - 合并后的输出文件路径。
 * @returns {Promise<void>}
 */
function mergeVideoAndAudio(videoFilePath, audioFilePath, outputFilePath) {
  return new Promise((resolve, reject) => {
    console.log(`[3/4] 正在使用 FFmpeg 合并文件...`);
    ffmpeg()
      .input(videoFilePath)
      .input(audioFilePath)
      .videoCodec("h264_nvenc") // 使用 NVIDIA GPU 硬编码，如果服务器没有 GPU，请改为 'libx264'
      .audioCodec("aac")
      .on("end", () => {
        console.log(`[3/4] ✔️ 文件合并成功: ${outputFilePath}`);
        resolve();
      })
      .on("error", (err) => {
        console.error("❌ FFmpeg 合并失败:", err);
        reject(new Error("视频文件合并失败，请检查服务器 FFmpeg 配置。"));
      })
      .save(outputFilePath);
  });
}

/**
 * @description 将视频的元数据存入或更新到数据库。
 * @param {object} videoData - 从 `scrapeBilibiliVideo` 获取的视频数据。
 * @param {boolean} exists - 视频是否已存在于数据库中。
 * @returns {Promise<object>} - 整理后的、包含下载链接的视频数据。
 */
async function saveOrUpdateVideoInDb(videoData, exists) {
  console.log(`[4/4] 正在将视频信息 ${exists ? "更新" : "写入"} 数据库...`);

  const downloadLink = `http://${SERVER_HOST}:${PORT}/${videoData.bvid}.mp4`;

  const record = {
    bvid: videoData.bvid,
    aid: videoData.aid,
    cid: videoData.cid,
    tname: videoData.tname,
    pic: videoData.pic,
    title: videoData.title,
    desc: videoData.desc,
    duration: videoData.duration,
    pubdate: videoData.pubdate,
    name: videoData.name,
    face: videoData.face,
    view: videoData.view,
    danmaku: videoData.danmaku,
    reply: videoData.reply,
    favorite: videoData.favorite,
    coin: videoData.coin,
    share: videoData.share,
    like: videoData.like,
    download_link: downloadLink,
  };

  try {
    if (exists) {
      const [updateResult] = await db.query(
        "UPDATE videos SET ? WHERE bvid = ?",
        [record, videoData.bvid]
      );
      if (updateResult.affectedRows === 0)
        throw new Error("更新数据库失败，未找到对应记录。");
    } else {
      const [insertResult] = await db.query("INSERT INTO videos SET ?", record);
      if (insertResult.affectedRows === 0) throw new Error("插入数据库失败。");
    }
    console.log(`[4/4] ✔️ 数据库操作成功!`);
    return record;
  } catch (error) {
    console.error("❌ 数据库操作失败:", error);
    throw new Error("数据库操作失败，请检查数据库连接或表结构。");
  }
}

/**
 * @description 获取数据库中所有视频的列表。
 * @returns {Promise<Array>} - 视频信息数组。
 */
async function listAllVideos() {
  try {
    const [rows] = await db.query("SELECT * FROM videos ORDER BY id DESC");
    return rows;
  } catch (error) {
    console.error("❌ 查询视频列表失败:", error);
    throw new Error("获取视频列表失败。");
  }
}

/**
 * @description 主流程函数：处理单个视频的下载和入库请求。
 * @param {string} url - 视频 URL。
 * @returns {Promise<object>} - 处理完成后的视频数据。
 */
async function processVideoRequest(url) {
  const videoData = await scrapeBilibiliVideo(url);
  const { bvid, cid } = videoData;

  const [rows] = await db.query("SELECT * FROM videos WHERE bvid = ?", [bvid]);
  const videoExists = rows.length > 0;

  // 无论视频是否存在，我们都更新/插入最新的信息。
  // 如果视频文件不存在，则执行下载和合并。
  const outputFilePath = path.join(videoDir, `${bvid}.mp4`);
  let fileExists = false;
  try {
    await fs.access(outputFilePath);
    fileExists = true;
    console.log(`ℹ️ 视频文件 ${bvid}.mp4 已存在，跳过下载和合并步骤。`);
  } catch (error) {
    // 文件不存在，执行下载和合并
  }

  if (!fileExists) {
    const { videoFilePath, audioFilePath } = await downloadFiles(bvid, cid);
    await mergeVideoAndAudio(videoFilePath, audioFilePath, outputFilePath);

    // 清理临时文件
    try {
      await fs.unlink(videoFilePath);
      await fs.unlink(audioFilePath);
      console.log(`🧹 临时文件已清理。`);
    } catch (cleanError) {
      console.warn(`⚠️ 清理临时文件失败: ${cleanError.message}`);
    }
  }

  const finalData = await saveOrUpdateVideoInDb(videoData, videoExists);
  return finalData;
}

module.exports = {
  listAllVideos,
  processVideoRequest,
};
这是以前的网页代码
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bilibili 登录</title>
</head>
<body>
    <h1>Bilibili 登录与视频解析</h1>
    <div id="qrcode" style="display: none;">
        <img id="qrcode_img" src="" alt="二维码加载中...">
    </div>
    <p id="status">状态：检查中...</p>
    <div id="video_tools" style="display: none;">
        <input id="video_input" type="text" placeholder="输入视频链接或 BV/EP/SS 号">
        <button id="parse_button" onclick="parseVideo()">解析</button>
        <div id="video_result"></div>
    </div>
    <button id="logout_btn" style="display: none;" onclick="logout()">退出登录</button>


    <p><strong>选择视频画质：</strong></p>
    <select id="quality_select">
        <!-- 动态填充画质选项 -->
    </select>
    <button id="download_btn" onclick="downloadVideo()">下载</button>
    <script>
        var datas;
        async function checkLoginStatus() {
            const response = await fetch("/check_login_status");
            const data = await response.json();

            if (data.is_logged_in) {
                document.getElementById("status").innerText = `状态：已登录 (用户ID: ${data.dedeuserid})`;
                document.getElementById("logout_btn").style.display = "block";
                document.getElementById("video_tools").style.display = "block";
                document.getElementById("qrcode").style.display = "none";
            } else {
                document.getElementById("status").innerText = "状态：未登录，生成二维码中...";
                document.getElementById("logout_btn").style.display = "none";
                document.getElementById("video_tools").style.display = "none";
                fetchQRCode();
            }
        }

        async function fetchQRCode() {
            const response = await fetch("/generate_qrcode");
            const data = await response.json();
            if (!data.is_logged_in && data.qrcode_url) {
                document.getElementById("qrcode_img").src = data.qrcode_url;
                document.getElementById("qrcode").style.display = "block";
                checkStatus(data.qrcode_key);
            } else {
                document.getElementById("status").innerText = "二维码生成失败";
            }
        }

        async function checkStatus(qrcode_key) {
            const statusURL = `/get_status?qrcode_key=${qrcode_key}`;
            while (true) {
                const response = await fetch(statusURL);
                const statusData = await response.json();
                document.getElementById("status").innerText = `状态：${statusData.message || "未知状态"}`;

                if (statusData.status === "success") {
                    document.getElementById("qrcode").style.display = "none";
                    checkLoginStatus();
                    break;
                }

                if (statusData.status === "expired") {
                    document.getElementById("status").innerText = "状态：二维码已过期";
                    break;
                }

                await new Promise(resolve => setTimeout(resolve, 7893));
            }
        }

    async function parseVideo() {
    const input = document.getElementById("video_input").value.trim();
    if (!input) {
        alert("请输入视频链接或 BV/EP/SS 号");
        return;
    }

    document.getElementById("video_result").innerText = "解析中，请稍候...";


    try {
        const response = await fetch(`/parse_video?input=${encodeURIComponent(input)}`);
        const data = await response.json();
        datas = data;
        if (data.error) {
            document.getElementById("video_result").innerText = `错误：${data.error}`;
        } else {
            const resultHtml = `
                <p><strong>标题：</strong>${data.title}</p>
                <p><strong>描述：</strong>${data.desc}</p>
                <p><strong>视频类型：</strong>${data.type}</p>
            `;
            document.getElementById("video_result").innerHTML = resultHtml;

            // 清空画质选择列表并重新填充
            const qualitySelect = document.getElementById("quality_select");
            qualitySelect.innerHTML = ""; // 清空已有选项

            data.play_info.accept_quality.forEach((quality, index) => {
                const description = data.play_info.accept_description[index];
                const option = document.createElement("option");
                option.value = quality; // 使用 `accept_quality` 的值作为选项值
                option.innerText = `画质：${description} (质量编号: ${quality})`;
                qualitySelect.appendChild(option);
            });
        }
    } catch (err) {
        document.getElementById("video_result").innerText = `解析失败：${err.message}`;
    }
}
    async function downloadVideo() {
    const qualitySelect = document.getElementById("quality_select");
    const selectedQuality = qualitySelect.value;

    if (!selectedQuality) {
        alert("请选择画质");
        return;
    }

    const quality = datas.play_info.dash.video.filter(item => item.id == selectedQuality);
    if (quality.length === 0) {
        alert("未找到对应质量的视频链接");
        return;
    }
        console.log(quality)
    try {
        const response = await fetch(`/download?bvid=${datas.bvid}&cid=${datas.cid}&quality=${selectedQuality}`);
        const data = await response.json();

        if (data.error) {
            // document.getElementById('result').innerText = `错误: ${data.error}`;
        } else {
             // document.getElementById('result').innerText = `下载成功! 视频路径: ${data.video_file}, 音频路径: ${data.audio_file}`;
             // const error = await response.json();
             alert( `下载成功! 视频路径: ${data.video_file}, 音频路径: ${data.audio_file}`);
        }
    } catch (error) {
        // document.getElementById('result').innerText = `请求失败: ${error.message}`;
        // alert(`下载失败：${err.message}`);
        alert(`下载失败`);
    }
    // const videoUrl = videoUrls[0].baseUrl;
    // const audioUrl = datas.play_info.dash.audio[0].backupUrl[0];
    //
    // try {
    //     const downloadUrl = `/download?video_url=${encodeURIComponent(videoUrl)}&audio_url=${encodeURIComponent(audioUrl)}&quality=${selectedQuality}`;
    //     const response = await fetch(downloadUrl);
    //     if (response.ok) {
    //         const blob = await response.blob();
    //         const downloadLink = document.createElement("a");
    //         downloadLink.href = URL.createObjectURL(blob);
    //         downloadLink.download = `output_${selectedQuality}.mp4`;
    //         downloadLink.click();
    //     } else {
    //         const error = await response.json();
    //         alert(`下载失败：${error.error}`);
    //     }
    // } catch (err) {
    //     alert(`下载失败：${err.message}`);
    // }
}



        async function logout() {
            const response = await fetch("/logout", { method: "POST" });
            const data = await response.json();
            document.getElementById("status").innerText = data.message;
            document.getElementById("logout_btn").style.display = "none";
            document.getElementById("video_tools").style.display = "none";
            document.getElementById("qrcode").style.display = "none";
            checkLoginStatus();
        }

        checkLoginStatus();
    </script>
</body>
</html>
