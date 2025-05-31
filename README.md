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
    console.log('开始处理登录成功，URL:', loginUrl);
    
    let cookieObj = {};
    let cookieString = '';
    
    // 方法1: 从URL参数中解析cookie（适用于crossDomain类型的URL）
    try {
      const urlObj = new URL(loginUrl);
      const urlParams = urlObj.searchParams;
      
      // 检查URL参数中是否包含cookie信息
      if (urlParams.has('DedeUserID') && urlParams.has('bili_jct')) {
        cookieObj.DedeUserID = urlParams.get('DedeUserID');
        cookieObj.bili_jct = urlParams.get('bili_jct');
        cookieObj.SESSDATA = urlParams.get('SESSDATA') || '';
        cookieObj.DedeUserID__ckMd5 = urlParams.get('DedeUserID__ckMd5') || '';
        
        cookieString = `DedeUserID=${cookieObj.DedeUserID}; bili_jct=${cookieObj.bili_jct}; SESSDATA=${cookieObj.SESSDATA}; DedeUserID__ckMd5=${cookieObj.DedeUserID__ckMd5}; `;
        console.log('从URL参数中解析到cookie:', cookieObj);
      }
    } catch (urlError) {
      console.log('URL解析失败，尝试其他方法:', urlError.message);
    }
    
    // 方法2: 如果URL解析失败，尝试访问登录URL获取cookie
    if (!cookieObj.DedeUserID || !cookieObj.bili_jct) {
      console.log('尝试通过HTTP请求获取cookie');
      
      try {
        const response = await axios.get(loginUrl, {
          headers: {
            ...BILIBILI_HEADERS,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          maxRedirects: 10,
          timeout: 10000,
          validateStatus: function (status) {
            return status >= 200 && status < 400;
          }
        });
        
        const cookies = response.headers['set-cookie'];
        console.log('HTTP响应headers:', response.headers);
        console.log('HTTP响应cookie:', cookies);
        
        if (cookies && cookies.length > 0) {
          cookies.forEach(cookie => {
            const parts = cookie.split(';')[0].split('=');
            if (parts.length === 2) {
              cookieObj[parts[0]] = parts[1];
              cookieString += `${parts[0]}=${parts[1]}; `;
            }
          });
        }
        
        // 检查响应体是否包含cookie信息
        if (response.data && typeof response.data === 'object') {
          console.log('HTTP响应数据:', response.data);
          
          // 检查是否有cookie_info字段
          if (response.data.cookie_info && response.data.cookie_info.cookies) {
            response.data.cookie_info.cookies.forEach(cookie => {
              cookieObj[cookie.name] = cookie.value;
              cookieString += `${cookie.name}=${cookie.value}; `;
            });
          }
        }
      } catch (httpError) {
        console.log('HTTP请求失败:', httpError.message);
      }
    }
    
    // 方法3: 尝试解析URL中的所有参数
    if (!cookieObj.DedeUserID || !cookieObj.bili_jct) {
      console.log('尝试解析URL中的所有参数');
      
      // 使用更强的正则表达式解析URL参数
      const paramRegex = /[?&]([^=&]+)=([^&]*)/g;
      let match;
      
      while ((match = paramRegex.exec(loginUrl)) !== null) {
        const key = decodeURIComponent(match[1]);
        const value = decodeURIComponent(match[2]);
        
        if (['DedeUserID', 'bili_jct', 'SESSDATA', 'DedeUserID__ckMd5', 'sid'].includes(key)) {
          cookieObj[key] = value;
          cookieString += `${key}=${value}; `;
        }
      }
    }
    
    const dedeuserid = cookieObj.DedeUserID;
    const bili_jct = cookieObj.bili_jct;
    const sessdata = cookieObj.SESSDATA;
    
    console.log('最终解析的cookie:', { dedeuserid, bili_jct, sessdata, cookieString });
    
    if (!dedeuserid || !bili_jct) {
      throw new Error(`登录cookie不完整: DedeUserID=${dedeuserid}, bili_jct=${bili_jct}, SESSDATA=${sessdata}`);
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
 * @param {string|number} accountIdentifier - 账号标识符（可以是主键ID或dedeuserid）
 */
async function deleteBilibiliAccount(userId, accountIdentifier) {
  try {
    console.log('删除账号参数:', { userId, accountIdentifier, userIdType: typeof userId, accountIdentifierType: typeof accountIdentifier });
    
    // 先尝试通过主键ID查询
    let [existingAccount] = await db.promise().query(
      'SELECT * FROM bilibili_accounts WHERE id = ?',
      [accountIdentifier]
    );
    
    // 如果通过主键ID没找到，尝试通过dedeuserid查询
    if (existingAccount.length === 0) {
      [existingAccount] = await db.promise().query(
        'SELECT * FROM bilibili_accounts WHERE dedeuserid = ?',
        [accountIdentifier]
      );
    }
    
    console.log('查询到的账号:', existingAccount);
    
    if (existingAccount.length === 0) {
      throw new Error(`账号 ${accountIdentifier} 不存在`);
    }
    
    const account = existingAccount[0];
    
    if (account.user_id != userId) {
      throw new Error(`无权限删除账号，账号属于用户ID ${account.user_id}，当前用户ID ${userId}`);
    }
    
    // 使用主键ID进行删除
    const [result] = await db.promise().query(
      'DELETE FROM bilibili_accounts WHERE id = ? AND user_id = ?',
      [account.id, userId]
    );
    
    console.log('删除结果:', result);
    
    // 检查是否真正删除了数据
    if (result.affectedRows === 0) {
      throw new Error('删除操作未影响任何记录');
    }
    
    return result;
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

/**
 * 获取B站视频信息和下载链接
 * @param {string} bvid - 视频BVID
 * @param {string} cookieString - Cookie字符串
 * @returns {Object} 视频信息和下载链接
 */
async function getBilibiliVideoInfo(bvid, cookieString) {
  try {
    // 获取视频基本信息
    const videoInfoResponse = await axios.get(
      `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
      {
        headers: {
          ...BILIBILI_HEADERS,
          'Cookie': cookieString
        }
      }
    );

    if (videoInfoResponse.data.code !== 0) {
      throw new Error(`获取视频信息失败: ${videoInfoResponse.data.message}`);
    }

    const videoData = videoInfoResponse.data.data;
    const cid = videoData.cid;

    // 获取视频下载链接
    const playUrlResponse = await axios.get(
      `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=80&fnval=16&fourk=1`,
      {
        headers: {
          ...BILIBILI_HEADERS,
          'Cookie': cookieString,
          'Referer': `https://www.bilibili.com/video/${bvid}`
        }
      }
    );

    if (playUrlResponse.data.code !== 0) {
      throw new Error(`获取下载链接失败: ${playUrlResponse.data.message}`);
    }

    const playData = playUrlResponse.data.data;
    
    // 提取视频和音频链接
    let videoUrl = null;
    let audioUrl = null;
    
    if (playData.dash) {
      // DASH格式
      if (playData.dash.video && playData.dash.video.length > 0) {
        videoUrl = playData.dash.video[0].baseUrl || playData.dash.video[0].base_url;
      }
      if (playData.dash.audio && playData.dash.audio.length > 0) {
        audioUrl = playData.dash.audio[0].baseUrl || playData.dash.audio[0].base_url;
      }
    } else if (playData.durl && playData.durl.length > 0) {
      // FLV格式
      videoUrl = playData.durl[0].url;
    }

    // 返回完整的视频信息，包含所有可用字段
    return {
      // 基本信息
      aid: videoData.aid,
      bvid: videoData.bvid,
      cid: videoData.cid,
      title: videoData.title,
      description: videoData.desc,
      pic: videoData.pic,
      
      // 时间信息
      duration: videoData.duration,
      pubdate: videoData.pubdate,
      ctime: videoData.ctime,
      
      // 分区信息
      tid: videoData.tid,
      tname: videoData.tname,
      copyright: videoData.copyright,
      
      // UP主信息
      owner: {
        mid: videoData.owner.mid,
        name: videoData.owner.name,
        face: videoData.owner.face
      },
      
      // 统计信息
      stat: {
        view: videoData.stat.view,
        danmaku: videoData.stat.danmaku,
        reply: videoData.stat.reply,
        favorite: videoData.stat.favorite,
        coin: videoData.stat.coin,
        share: videoData.stat.share,
        like: videoData.stat.like,
        now_rank: videoData.stat.now_rank || 0,
        his_rank: videoData.stat.his_rank || 0,
        evaluation: videoData.stat.evaluation || ''
      },
      
      // 视频属性
      videos: videoData.videos, // 分P数量
      pages: videoData.pages || [],
      subtitle: videoData.subtitle || {},
      
      // 权限和状态
      state: videoData.state,
      attribute: videoData.attribute,
      
      // 下载相关
      downloadUrls: {
        video: videoUrl,
        audio: audioUrl
      },
      quality: playData.quality || 80,
      format: playData.format || 'mp4',
      
      // 其他信息
      mission_id: videoData.mission_id || null,
      redirect_url: videoData.redirect_url || null,
      
      // 标签信息
      tag: videoData.tag || [],
      
      // 荣誉信息
      honor_reply: videoData.honor_reply || {},
      
      // 用户权限
      user_garb: videoData.user_garb || {},
      
      // 互动信息
      elec: videoData.elec || null,
      
      // 合集信息
      ugc_season: videoData.ugc_season || null
    };
  } catch (error) {
    console.error('获取B站视频信息失败:', error);
    throw error;
  }
}

module.exports = {
  generateBilibiliQRCode,
  getBilibiliLoginStatus,
  getUserBilibiliAccounts,
  getActiveBilibiliAccount,
  toggleBilibiliAccountStatus,
  deleteBilibiliAccount,
  validateBilibiliCookie,
  getBilibiliVideoInfo
};
// model/video/videoRouters.js

const express = require("express");
const router = express.Router();
const videoUtils = require("./videoUtils");
const bilibiliUtils = require("../bilibili/bilibiliUtils");
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
 * @api {get} /api/video/user-list
 * @description 获取当前用户处理的视频列表
 * @access Protected - 需要用户登录
 */
router.get("/user-list", authorize(["1", "2", "3"]), async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    const videos = await videoUtils.getUserVideos(userId);
    res.status(200).json({
      code: 200,
      message: "成功获取用户视频列表",
      data: videos,
    });
  } catch (error) {
    res.status(500).json({
      code: 500,
      message: error.message || "获取用户视频列表失败",
      data: null,
    });
  }
});

/**
 * @api {post} /api/video/parse
 * @description 解析B站视频信息（不下载，仅获取视频详情）
 * @access Protected - 需要用户登录和B站账号
 * @body { "url": "视频的URL或BVID", "quality": "清晰度(可选)" }
 */
router.post("/parse", authorize(["1", "2", "3"]), async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    const { url, quality = 80 } = req.body;
    
    if (!url || !url.trim()) {
      return res.status(400).json({
        code: 400,
        message: "请提供有效的视频 URL",
        data: null,
      });
    }

    // 检查用户是否有活跃的B站账号
    const bilibiliAccount = await bilibiliUtils.getActiveBilibiliAccount(userId);
    if (!bilibiliAccount) {
      return res.status(400).json({
        code: 400,
        message: "请先登录B站账号",
        data: null
      });
    }

    console.log(`▶️ 开始解析视频: ${url}`);
    const result = await videoUtils.parseVideoInfo(url, bilibiliAccount.cookie_string, quality);
    console.log(`✅ 视频解析完成: ${result.title}`);
    
    res.status(200).json({
      code: 200,
      message: "视频解析成功",
      data: result,
    });
  } catch (error) {
    console.error(`❌ 解析视频失败:`, error);
    res.status(500).json({
      code: 500,
      message: error.message || "解析视频失败",
      data: null,
    });
  }
});

/**
 * @api {post} /api/video/process
 * @description 处理B站视频（解析、下载、合并、入库）
 * @access Protected - 需要用户登录和B站账号
 * @body { "url": "视频的URL或BVID", "quality": "清晰度(可选)", "downloadMode": "下载模式(可选)" }
 */
router.post("/process", authorize(["1", "2", "3"]), async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    const { url, quality = 80, downloadMode = "auto" } = req.body;
    
    if (!url || !url.trim()) {
      return res.status(400).json({
        code: 400,
        message: "请提供有效的视频 URL",
        data: null,
      });
    }

    // 检查用户是否有活跃的B站账号
    const bilibiliAccount = await bilibiliUtils.getActiveBilibiliAccount(userId);
    if (!bilibiliAccount) {
      return res.status(400).json({
        code: 400,
        message: "请先登录B站账号",
        data: null
      });
    }

    console.log(`▶️ 开始处理视频请求: ${url}`);
    const result = await videoUtils.processVideoRequest({
      url,
      userId,
      cookieString: bilibiliAccount.cookie_string,
      quality,
      downloadMode,
      bilibiliAccountId: bilibiliAccount.id
    });
    console.log(`✅ 视频处理完成: ${result.title}`);
    
    res.status(201).json({
      code: 201,
      message: "视频处理成功并已入库",
      data: result,
    });
  } catch (error) {
    console.error(`❌ 处理视频失败:`, error);
    res.status(500).json({
      code: 500,
      message: error.message || "处理视频时发生未知错误",
      data: null,
    });
  }
});

/**
 * @api {post} /api/video/batch-process
 * @description 批量处理B站视频
 * @access Protected - 需要用户登录和B站账号
 * @body { "urls": ["视频URL数组"], "quality": "清晰度(可选)", "downloadMode": "下载模式(可选)" }
 */
router.post("/batch-process", authorize(["1", "2", "3"]), async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    const { urls, quality = 80, downloadMode = "auto" } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        code: 400,
        message: "请提供有效的视频 URL 数组",
        data: null,
      });
    }

    if (urls.length > 10) {
      return res.status(400).json({
        code: 400,
        message: "批量处理最多支持10个视频",
        data: null,
      });
    }

    // 检查用户是否有活跃的B站账号
    const bilibiliAccount = await bilibiliUtils.getActiveBilibiliAccount(userId);
    if (!bilibiliAccount) {
      return res.status(400).json({
        code: 400,
        message: "请先登录B站账号",
        data: null
      });
    }

    console.log(`▶️ 开始批量处理 ${urls.length} 个视频`);
    const results = await videoUtils.batchProcessVideos({
      urls,
      userId,
      cookieString: bilibiliAccount.cookie_string,
      quality,
      downloadMode,
      bilibiliAccountId: bilibiliAccount.id
    });
    console.log(`✅ 批量处理完成，成功: ${results.success.length}, 失败: ${results.failed.length}`);
    
    res.status(200).json({
      code: 200,
      message: `批量处理完成，成功: ${results.success.length}, 失败: ${results.failed.length}`,
      data: results,
    });
  } catch (error) {
    console.error(`❌ 批量处理视频失败:`, error);
    res.status(500).json({
      code: 500,
      message: error.message || "批量处理视频失败",
      data: null,
    });
  }
});

/**
 * @api {delete} /api/video/:id
 * @description 删除视频记录和文件
 * @access Protected - 需要用户登录
 */
router.delete("/:id", authorize(["1", "2", "3"]), async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    const { id } = req.params;
    const { deleteFile = false } = req.query;
    
    await videoUtils.deleteVideo(id, userId, deleteFile === 'true');
    
    res.status(200).json({
      code: 200,
      message: "视频删除成功",
      data: null,
    });
  } catch (error) {
    console.error(`❌ 删除视频失败:`, error);
    res.status(500).json({
      code: 500,
      message: error.message || "删除视频失败",
      data: null,
    });
  }
});

/**
 * @api {post} /api/video/generate-download-link
 * @description 生成安全下载链接
 * @access Protected - 需要用户登录
 */
router.post("/generate-download-link", authorize(["1", "2", "3"]), async (req, res) => {
  try {
    const { fileName } = req.body;
    const userId = req.user.uid || req.user.id;
    
    if (!fileName) {
      return res.status(400).json({
        code: 400,
        message: "文件名不能为空",
        data: null,
      });
    }
    
    // 检查用户是否有权限下载该文件
    const hasPermission = await videoUtils.checkDownloadPermission(fileName, userId);
    if (!hasPermission) {
      return res.status(403).json({
        code: 403,
        message: "无权限下载该文件",
        data: null,
      });
    }
    
    // 生成安全下载链接
    const downloadInfo = videoUtils.generateSecureDownloadLink(fileName, userId);
    
    res.status(200).json({
      code: 200,
      message: "下载链接生成成功",
      data: downloadInfo,
    });
  } catch (error) {
    console.error("生成下载链接失败:", error);
    res.status(500).json({
      code: 500,
      message: error.message || "生成下载链接失败",
      data: null,
    });
  }
});

/**
 * @api {get} /api/video/secure-download
 * @description 安全文件下载（支持断点续传）
 * @access Public - 通过token验证
 */
router.get("/secure-download", async (req, res) => {
  try {
    const { token, file } = req.query;
    
    if (!token || !file) {
      return res.status(400).json({
        code: 400,
        message: "缺少必要参数",
        data: null,
      });
    }
    
    // 验证token
    const payload = videoUtils.verifyDownloadToken(token);
    if (!payload) {
      return res.status(401).json({
        code: 401,
        message: "下载链接已过期或无效",
        data: null,
      });
    }
    
    // 验证文件名是否匹配
    if (payload.fileName !== file) {
      return res.status(403).json({
        code: 403,
        message: "文件访问权限验证失败",
        data: null,
      });
    }
    
    // 再次检查用户权限
    const hasPermission = await videoUtils.checkDownloadPermission(file, payload.userId);
    if (!hasPermission) {
      return res.status(403).json({
        code: 403,
        message: "无权限下载该文件",
        data: null,
      });
    }
    
    // 处理安全下载
    await videoUtils.handleSecureDownload(file, req, res);
    
  } catch (error) {
    console.error("安全下载失败:", error);
    if (!res.headersSent) {
      res.status(500).json({
        code: 500,
        message: error.message || "下载失败",
        data: null,
      });
    }
  }
});

/**
 * @api {get} /api/video/download/:bvid
 * @description 直接下载视频（兼容旧版本）
 * @access Protected - 需要用户登录
 */
router.get("/download/:bvid", authorize(["1", "2", "3"]), async (req, res) => {
  try {
    const { bvid } = req.params;
    const userId = req.user.uid || req.user.id;
    
    // 构造文件名
    const fileName = `${bvid}.mp4`;
    
    // 检查用户是否有权限下载该文件
    const hasPermission = await videoUtils.checkDownloadPermission(fileName, userId);
    if (!hasPermission) {
      return res.status(403).json({
        code: 403,
        message: "无权限下载该文件",
        data: null,
      });
    }
    
    // 处理安全下载
    await videoUtils.handleSecureDownload(fileName, req, res);
    
  } catch (error) {
    console.error("直接下载失败:", error);
    if (!res.headersSent) {
      res.status(500).json({
        code: 500,
        message: error.message || "下载失败",
        data: null,
      });
    }
  }
});

module.exports = router;
// model/video/videoUtils.js

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../../config/db").promise();
const bilibiliUtils = require("../bilibili/bilibiliUtils");

// 配置路径
const DOWNLOAD_DIR = path.join(__dirname, "../../downloads"); // 临时下载目录
const VIDEO_DIR = path.join(__dirname, "../../videos"); // 最终视频存储目录
const FFMPEG_PATH = "ffmpeg"; // FFmpeg 可执行文件路径，确保已安装并在 PATH 中

// 确保目录存在
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  console.log(`📁 创建临时下载目录: ${DOWNLOAD_DIR}`);
}

if (!fs.existsSync(VIDEO_DIR)) {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });
  console.log(`📁 创建视频存储目录: ${VIDEO_DIR}`);
}

// 视频质量映射
const QUALITY_MAP = {
  120: "4K 超清",
  116: "1080P60 高清",
  112: "1080P+ 高清",
  80: "1080P 高清",
  74: "720P60 高清",
  64: "720P 高清",
  32: "480P 清晰",
  16: "360P 流畅"
};

/**
 * 提取BVID从URL
 * @param {string} url - 视频URL或BVID
 * @returns {string} BVID
 */
function extractBVID(url) {
  if (url.startsWith('BV')) {
    return url;
  }
  const bvidMatch = url.match(/BV[a-zA-Z0-9]+/);
  if (bvidMatch) {
    return bvidMatch[0];
  }
  throw new Error('无法从URL中提取BVID');
}

/**
 * 解析B站视频信息（使用B站账号Cookie）
 * @param {string} url - 视频URL或BVID
 * @param {string} cookieString - B站账号Cookie
 * @param {number} quality - 视频质量
 * @returns {Promise<Object>} 视频信息
 */
async function parseVideoInfo(url, cookieString, quality = 80) {
  try {
    const bvid = extractBVID(url);
    console.log(`🔍 正在解析视频信息: ${bvid}`);
    
    // 获取视频信息和下载链接
    const videoInfo = await bilibiliUtils.getBilibiliVideoInfo(bvid, cookieString);
    
    const result = {
      bvid: bvid,
      aid: videoInfo.aid || null,
      title: videoInfo.title,
      description: videoInfo.description,
      duration: videoInfo.duration,
      view: videoInfo.stat.view,
      like: videoInfo.stat.like,
      coin: videoInfo.stat.coin,
      share: videoInfo.stat.share,
      reply: videoInfo.stat.reply,
      favorite: videoInfo.stat.favorite,
      owner: {
        mid: videoInfo.owner.mid,
        name: videoInfo.owner.name,
        face: videoInfo.owner.face || null
      },
      pubdate: videoInfo.pubdate || null,
      pic: videoInfo.pic,
      pages: videoInfo.pages || [],
      quality: quality,
      qualityDesc: QUALITY_MAP[quality] || '未知画质',
      downloadUrls: videoInfo.downloadUrls,
      videoUrl: videoInfo.downloadUrls.video,
      audioUrl: videoInfo.downloadUrls.audio,
      fileSize: null // 文件大小需要在下载时获取
    };
    
    console.log(`✅ 视频信息解析完成: ${result.title}`);
    return result;
  } catch (error) {
    console.error(`❌ 解析视频信息失败:`, error.message);
    throw new Error(`解析视频信息失败: ${error.message}`);
  }
}

/**
 * 下载文件（支持进度回调）
 * @param {string} url - 下载链接
 * @param {string} filePath - 保存路径
 * @param {string} cookieString - B站Cookie
 * @param {Function} progressCallback - 进度回调函数
 * @returns {Promise<void>}
 */
async function downloadFile(url, filePath, cookieString, progressCallback) {
  try {
    console.log(`⬇️ 开始下载文件: ${path.basename(filePath)}`);
    
    const response = await axios({
      method: "GET",
      url: url,
      responseType: "stream",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.bilibili.com/",
        "Cookie": cookieString,
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
      },
      timeout: 30000
    });

    const totalLength = parseInt(response.headers['content-length'], 10);
    let downloadedLength = 0;

    const writer = fs.createWriteStream(filePath);
    
    response.data.on('data', (chunk) => {
      downloadedLength += chunk.length;
      if (progressCallback && totalLength) {
        const progress = (downloadedLength / totalLength * 100).toFixed(2);
        progressCallback(progress, downloadedLength, totalLength);
      }
    });
    
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        console.log(`✅ 文件下载完成: ${path.basename(filePath)}`);
        resolve();
      });
      writer.on("error", (error) => {
        console.error(`❌ 文件下载失败: ${path.basename(filePath)}`, error);
        reject(error);
      });
    });
  } catch (error) {
    console.error(`❌ 下载文件失败: ${path.basename(filePath)}`, error.message);
    throw error;
  }
}

/**
 * 使用 FFmpeg 合并视频和音频（支持进度回调）
 * @param {string} videoPath - 视频文件路径
 * @param {string} audioPath - 音频文件路径
 * @param {string} outputPath - 输出文件路径
 * @param {Function} progressCallback - 进度回调函数
 * @returns {Promise<void>}
 */
function mergeVideoAndAudio(videoPath, audioPath, outputPath, progressCallback) {
  return new Promise((resolve, reject) => {
    console.log(`🔧 开始合并视频和音频: ${path.basename(outputPath)}`);

    const ffmpeg = spawn(FFMPEG_PATH, [
      "-i", videoPath,
      "-i", audioPath,
      "-c:v", "copy",
      "-c:a", "aac",
      "-strict", "experimental",
      "-y", // 覆盖输出文件
      outputPath,
    ]);

    let duration = null;
    
    ffmpeg.stderr.on("data", (data) => {
      const output = data.toString();
      
      // 提取总时长
      if (!duration) {
        const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseInt(durationMatch[3]);
          duration = hours * 3600 + minutes * 60 + seconds;
        }
      }
      
      // 提取当前进度
      if (duration && progressCallback) {
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
        if (timeMatch) {
          const hours = parseInt(timeMatch[1]);
          const minutes = parseInt(timeMatch[2]);
          const seconds = parseInt(timeMatch[3]);
          const currentTime = hours * 3600 + minutes * 60 + seconds;
          const progress = (currentTime / duration * 100).toFixed(2);
          progressCallback(progress, currentTime, duration);
        }
      }
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ 视频合并完成: ${path.basename(outputPath)}`);
        resolve();
      } else {
        console.error(`❌ FFmpeg 进程退出，代码: ${code}`);
        reject(new Error(`FFmpeg 合并失败，退出代码: ${code}`));
      }
    });

    ffmpeg.on("error", (error) => {
      console.error(`❌ FFmpeg 启动失败:`, error);
      reject(error);
    });
  });
}

/**
 * 将视频信息保存到数据库
 * @param {Object} videoInfo - 视频信息
 * @param {string} filePath - 文件路径
 * @param {string} playUrl - 播放地址
 * @param {number} userId - 用户ID
 * @param {number} bilibiliAccountId - B站账号ID
 * @returns {Promise<Object>} 数据库记录
 */
async function saveOrUpdateVideoInDb(videoInfo, filePath, playUrl, userId, bilibiliAccountId) {
  try {
    console.log(`💾 保存视频信息到数据库: ${videoInfo.title}`);

    // 检查视频是否已存在（根据bvid）
    const [existingVideos] = await db.execute(
      "SELECT * FROM videos WHERE bvid = ?",
      [videoInfo.bvid]
    );

    if (existingVideos.length > 0) {
      // 更新现有记录
      await db.execute(
        `UPDATE videos SET 
         title = ?, pic = ?, view = ?, danmaku = ?, \`like\` = ?, 
         coin = ?, favorite = ?, share = ?, reply = ?, 
         name = ?, face = ?, pubdate = ?, 
         quality = ?, \`desc\` = ?, duration = ?, aid = ?, download_link = ?,
         cid = ?, tname = ?, current_viewers = ?
         WHERE bvid = ?`,
        [
          videoInfo.title,
          videoInfo.pic || "",
          videoInfo.stat?.view || 0,
          videoInfo.stat?.danmaku || 0,
          videoInfo.stat?.like || 0,
          videoInfo.stat?.coin || 0,
          videoInfo.stat?.favorite || 0,
          videoInfo.stat?.share || 0,
          videoInfo.stat?.reply || 0,
          videoInfo.owner?.name || "未知",
          videoInfo.owner?.face || "",
          videoInfo.pubdate || "",
          videoInfo.quality || 80,
          videoInfo.description || "",
          videoInfo.duration || 0,
          videoInfo.aid || "",
          playUrl,
          videoInfo.cid || "",
          videoInfo.tname || "",
          videoInfo.stat?.now_rank || 0,
          videoInfo.bvid
        ]
      );
      
      console.log(`✅ 视频信息已更新: ${videoInfo.title}`);
      return { 
        id: existingVideos[0].id, 
        updated: true,
        title: videoInfo.title,
        bvid: videoInfo.bvid,
        filePath: filePath,
        playUrl: playUrl
      };
    } else {
      // 插入新记录
      const [result] = await db.execute(
        `INSERT INTO videos (
          bvid, aid, title, pic, view, danmaku, \`like\`, coin, favorite, share, reply,
          name, face, pubdate, quality, \`desc\`, duration, download_link, cid, tname, current_viewers
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          videoInfo.bvid,
          videoInfo.aid || "",
          videoInfo.title,
          videoInfo.pic || "",
          videoInfo.stat?.view || 0,
          videoInfo.stat?.danmaku || 0,
          videoInfo.stat?.like || 0,
          videoInfo.stat?.coin || 0,
          videoInfo.stat?.favorite || 0,
          videoInfo.stat?.share || 0,
          videoInfo.stat?.reply || 0,
          videoInfo.owner?.name || "未知",
          videoInfo.owner?.face || "",
          videoInfo.pubdate || "",
          videoInfo.quality || 80,
          videoInfo.description || "",
          videoInfo.duration || 0,
          playUrl,
          videoInfo.cid || "",
          videoInfo.tname || "",
          videoInfo.stat?.now_rank || 0
        ]
      );
      
      console.log(`✅ 视频信息已保存: ${videoInfo.title}`);
      return { 
        id: result.insertId, 
        updated: false,
        title: videoInfo.title,
        bvid: videoInfo.bvid,
        filePath: filePath,
        playUrl: playUrl
      };
    }
  } catch (error) {
    console.error('❌ 保存视频信息到数据库失败:', error);
    throw error;
  }
}


/**
 * 获取所有视频列表
 * @returns {Promise<Array>} 视频列表
 */
async function listAllVideos() {
  try {
    const [videos] = await db.execute(
      `SELECT * FROM videos ORDER BY id DESC`
    );
    return videos;
  } catch (error) {
    console.error(`❌ 获取视频列表失败:`, error);
    throw error;
  }
}

/**
 * 获取用户的视频列表
 * @param {number} userId - 用户ID（暂时不使用，返回所有视频）
 * @returns {Promise<Array>} 用户视频列表
 */
async function getUserVideos(userId) {
  try {
    // 由于当前表结构没有user_id字段，暂时返回所有视频
    const [videos] = await db.execute(
      `SELECT * FROM videos ORDER BY id DESC`
    );
    return videos;
  } catch (error) {
    console.error(`❌ 获取用户视频列表失败:`, error);
    throw error;
  }
}

/**
 * 删除视频记录和文件
 * @param {number} videoId - 视频ID
 * @param {number} userId - 用户ID（暂时不使用）
 * @param {boolean} deleteFile - 是否删除文件
 * @returns {Promise<void>}
 */
async function deleteVideo(videoId, userId, deleteFile = false) {
  try {
    // 获取视频信息
    const [videos] = await db.execute(
      "SELECT * FROM videos WHERE id = ?",
      [videoId]
    );
    
    if (videos.length === 0) {
      throw new Error('视频不存在');
    }
    
    const video = videos[0];
    
    // 删除数据库记录
    await db.execute("DELETE FROM videos WHERE id = ?", [videoId]);
    
    // 删除文件
    if (deleteFile && video.file_path && fs.existsSync(video.file_path)) {
      fs.unlinkSync(video.file_path);
      console.log(`🗑️ 删除视频文件: ${video.file_path}`);
    }
    
    console.log(`✅ 删除视频记录: ${video.title}`);
  } catch (error) {
    console.error(`❌ 删除视频失败:`, error);
    throw error;
  }
}

/**
 * 处理视频请求的主函数
 * @param {Object} options - 处理选项
 * @returns {Promise<Object>} 处理结果
 */
async function processVideoRequest(options) {
  const {
    url,
    userId,
    cookieString,
    quality = 80,
    downloadMode = "auto",
    bilibiliAccountId
  } = options;
  
  try {
    // 0. 提取BVID进行预检查
    const bvid = extractBVID(url);
    if (!bvid) {
      throw new Error('无法从URL中提取BVID');
    }
    
    // 1. 检查数据库和文件是否已存在（优化：避免重复解析）
    const finalFileName = `${bvid}.mp4`;
    const finalVideoPath = path.join(VIDEO_DIR, finalFileName);
    
    // 检查数据库中是否已有记录
    const [existingRecords] = await db.execute(
      'SELECT * FROM videos WHERE bvid = ?',
      [bvid]
    );
    
    // 检查文件是否存在
    const fileExists = fs.existsSync(finalVideoPath);
    
    if (existingRecords.length > 0 && fileExists) {
      console.log(`✅ 发现已存在的视频记录和文件: ${bvid}`);
      
      // 只解析基本信息用于更新数据库
      const videoInfo = await parseVideoInfo(url, cookieString, quality);
      
      // 生成播放地址
      const serverPort = process.env.PORT || 3000;
      const serverHost = process.env.SERVER_HOST || 'localhost';
      const playUrl = `http://${serverHost}:${serverPort}/api/video/download/${finalFileName}`;
      
      // 更新数据库记录（保持文件路径不变）
      const existingRecord = existingRecords[0];
      await db.execute(
        `UPDATE videos SET 
         title = ?, pic = ?, view = ?, duration = ?, 
         download_link = ? 
         WHERE id = ?`,
        [
          videoInfo.title,
          videoInfo.pic,
          videoInfo.view,
          videoInfo.duration,
          playUrl,
          existingRecord.id
        ]
      );
      
      console.log(`🔄 已更新现有视频记录: ${videoInfo.title}`);
      
      return {
        id: existingRecord.id,
        updated: true,
        title: videoInfo.title,
        bvid: bvid,
        filePath: finalVideoPath,
        playUrl: playUrl,
        message: "视频已存在，仅更新数据库信息",
        downloadMode,
        qualityDesc: videoInfo.qualityDesc,
        skippedProcessing: true // 标记跳过了处理过程
      };
    }
    
    console.log(`🆕 开始处理新视频或重新处理: ${bvid}`);
    
    // 2. 解析视频信息（完整解析用于下载）
    const videoInfo = await parseVideoInfo(url, cookieString, quality);

    // 3. 创建文件名和路径
    const uniqueId = uuidv4().substring(0, 8);
    const tempVideoFileName = `${videoInfo.bvid}_${uniqueId}_video.mp4`;
    const tempAudioFileName = `${videoInfo.bvid}_${uniqueId}_audio.mp3`;
    const tempOutputFileName = `${videoInfo.bvid}_${uniqueId}_temp.mp4`;
    // finalFileName 已在前面声明过，这里不需要重复声明

    const tempVideoPath = path.join(DOWNLOAD_DIR, tempVideoFileName);
    const tempAudioPath = path.join(DOWNLOAD_DIR, tempAudioFileName);
    const tempOutputPath = path.join(DOWNLOAD_DIR, tempOutputFileName);
    // finalVideoPath 也已在前面声明过，这里不需要重复声明

    // 4. 下载视频和音频
    console.log(`📥 开始下载视频和音频...`);
    
    const downloadPromises = [];
    
    if (downloadMode === "video" || downloadMode === "auto") {
      downloadPromises.push(
        downloadFile(videoInfo.videoUrl, tempVideoPath, cookieString, (progress) => {
          console.log(`📹 视频下载进度: ${progress}%`);
        })
      );
    }
    
    if (downloadMode === "audio" || downloadMode === "auto") {
      downloadPromises.push(
        downloadFile(videoInfo.audioUrl, tempAudioPath, cookieString, (progress) => {
          console.log(`🎵 音频下载进度: ${progress}%`);
        })
      );
    }
    
    await Promise.all(downloadPromises);

    // 5. 合并视频和音频（如果都下载了）
    let tempFinalPath = tempOutputPath;
    if (downloadMode === "auto" && fs.existsSync(tempVideoPath) && fs.existsSync(tempAudioPath)) {
      console.log(`🔧 开始合并视频和音频: ${finalFileName}`);
      await mergeVideoAndAudio(tempVideoPath, tempAudioPath, tempOutputPath, (progress) => {
        console.log(`🔧 合并进度: ${progress}%`);
      });
      
      // 清理临时文件
      try {
        fs.unlinkSync(tempVideoPath);
        fs.unlinkSync(tempAudioPath);
        console.log(`🗑️ 清理临时文件完成`);
      } catch (cleanupError) {
        console.warn(`⚠️ 清理临时文件失败:`, cleanupError.message);
      }
    } else if (downloadMode === "video" && fs.existsSync(tempVideoPath)) {
      tempFinalPath = tempVideoPath;
    } else if (downloadMode === "audio" && fs.existsSync(tempAudioPath)) {
      tempFinalPath = tempAudioPath;
    }

    // 6. 移动文件到最终目录
    if (fs.existsSync(tempFinalPath)) {
      // 如果最终文件已存在，先删除
      if (fs.existsSync(finalVideoPath)) {
        fs.unlinkSync(finalVideoPath);
        console.log(`🗑️ 删除已存在的文件: ${finalFileName}`);
      }
      
      fs.renameSync(tempFinalPath, finalVideoPath);
      console.log(`📁 文件已移动到: ${finalVideoPath}`);
    } else {
      throw new Error('处理后的视频文件不存在');
    }

    // 7. 生成播放地址 - 使用SERVER_HOST配置
    const serverPort = process.env.PORT || 3000;
    const serverHost = process.env.SERVER_HOST || 'localhost';
    const playUrl = `http://${serverHost}:${serverPort}/api/video/download/${finalFileName}`;

    // 8. 保存到数据库
    const dbRecord = await saveOrUpdateVideoInDb(videoInfo, finalVideoPath, playUrl, userId, bilibiliAccountId);

    return {
      ...dbRecord,
      message: "视频处理完成",
      downloadMode,
      qualityDesc: videoInfo.qualityDesc,
      playUrl: playUrl
    };
  } catch (error) {
    console.error(`❌ 处理视频请求失败:`, error);
    throw error;
  }
}

/**
 * 批量处理视频
 * @param {Object} options - 批量处理选项
 * @returns {Promise<Object>} 批量处理结果
 */
async function batchProcessVideos(options) {
  const {
    urls,
    userId,
    cookieString,
    quality = 80,
    downloadMode = "auto",
    bilibiliAccountId
  } = options;
  
  const results = {
    success: [],
    failed: [],
    total: urls.length
  };
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      console.log(`📦 批量处理进度: ${i + 1}/${urls.length} - ${url}`);
      
      const result = await processVideoRequest({
        url,
        userId,
        cookieString,
        quality,
        downloadMode,
        bilibiliAccountId
      });
      
      results.success.push({
        url,
        result,
        index: i + 1
      });
      
      // 添加延迟避免请求过于频繁
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.error(`❌ 批量处理第 ${i + 1} 个视频失败:`, error.message);
      results.failed.push({
        url,
        error: error.message,
        index: i + 1
      });
    }
  }
  
  return results;
}

/**
 * 生成安全下载token
 * @param {string} fileName - 文件名
 * @param {string} userId - 用户ID
 * @param {number} expiresIn - 过期时间（秒），默认1小时
 * @returns {string} JWT token
 */
function generateDownloadToken(fileName, userId, expiresIn = 3600) {
  const payload = {
    fileName,
    userId,
    type: 'download',
    timestamp: Date.now()
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
}

/**
 * 验证下载token
 * @param {string} token - JWT token
 * @returns {object|null} 解码后的payload或null
 */
function verifyDownloadToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    console.error('Token验证失败:', error.message);
    return null;
  }
}

/**
 * 生成临时下载链接
 * @param {string} fileName - 文件名
 * @param {string} userId - 用户ID
 * @returns {object} 包含下载链接和token的对象
 */
function generateSecureDownloadLink(fileName, userId) {
  const token = generateDownloadToken(fileName, userId, 3600); // 1小时有效期
  const serverPort = process.env.PORT || 3000;
  const serverHost = process.env.SERVER_HOST || 'localhost';
  
  return {
    downloadUrl: `http://${serverHost}:${serverPort}/api/video/secure-download?token=${token}&file=${encodeURIComponent(fileName)}`,
    token,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString()
  };
}

/**
 * 检查用户是否有权限下载指定文件
 * @param {string} fileName - 文件名
 * @param {string} userId - 用户ID
 * @returns {boolean} 是否有权限
 */
async function checkDownloadPermission(fileName, userId) {
  try {
    // 从文件名提取BVID
    const bvid = fileName.replace(/\.(mp4|mp3)$/, '');
    
    // 查询数据库确认视频是否存在（由于videos表没有user_id字段，这里只检查视频是否存在）
    const [rows] = await db.execute(
      'SELECT id FROM videos WHERE bvid = ?',
      [bvid]
    );
    
    return rows.length > 0;
  } catch (error) {
    console.error('检查下载权限失败:', error);
    return false;
  }
}

/**
 * 安全文件下载处理
 * @param {string} fileName - 文件名
 * @param {object} req - Express请求对象
 * @param {object} res - Express响应对象
 */
async function handleSecureDownload(fileName, req, res) {
  try {
    const filePath = path.join(VIDEO_DIR, fileName);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        code: 404,
        message: '文件不存在'
      });
    }
    
    // 获取文件信息
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    
    // 设置响应头，支持断点续传
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', fileSize);
    
    // 处理Range请求（断点续传）
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunksize);
      
      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      // 完整文件下载
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }
    
  } catch (error) {
    console.error('安全下载处理失败:', error);
    res.status(500).json({
      code: 500,
      message: '下载失败'
    });
  }
}

module.exports = {
  parseVideoInfo,
  downloadFile,
  mergeVideoAndAudio,
  saveOrUpdateVideoInDb,
  listAllVideos,
  getUserVideos,
  deleteVideo,
  processVideoRequest,
  batchProcessVideos,
  extractBVID,
  QUALITY_MAP,
  generateDownloadToken,
  verifyDownloadToken,
  generateSecureDownloadLink,
  checkDownloadPermission,
  handleSecureDownload
};
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
// 提供视频文件的直接访问服务
// 移除静态文件服务 - 改为安全的token验证下载方案
// const path = require("path");
// const serveIndex = require("serve-index");
// const videoDir = path.join(__dirname, "videos");
// app.use("/api/videos", express.static(videoDir), serveIndex(videoDir, { icons: true }));

// --- 路由 ---
app.use("/api", userRouter); // 挂载用户路由，建议添加前缀 /user
app.use("/api/video", videoRouter); // 【新增】挂载视频路由，统一前缀 /video
app.use("/api/bilibili", bilibiliRouter); // 【新增】挂载B站路由，统一前缀 /bilibili

// --- 启动服务 ---
startHeartbeats(); // 启动数据库和 Redis 的心跳检测

server.listen(port, "0.0.0.0", () => {
  console.log(`✅ 服务器已成功启动，正在监听端口：http://0.0.0.0:${port}`);
});
import { Footer } from '@/components';
import { login, register, sendVerificationCode } from '@/services/ant-design-pro/api';
// 引入Bilibili主题相关的图标，这里用Ant Design的图标代替
import {
  LockOutlined,
  MobileOutlined,
  UserOutlined,
  MailOutlined,
  VideoCameraOutlined, // 用作Logo
  PlayCircleOutlined, // 其他登录方式图标
  HeartOutlined, // 其他登录方式图标
  SmileOutlined, // 其他登录方式图标
} from '@ant-design/icons';
import {
  LoginForm,
  ProFormCaptcha,
  ProFormCheckbox,
  ProFormText,
} from '@ant-design/pro-components';
import { FormattedMessage, Helmet, history, SelectLang, useIntl, useModel } from '@umijs/max';
import { Alert, message, Tabs, Form } from 'antd';
import { createStyles } from 'antd-style';
import React, { useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import type { ProFormInstance } from '@ant-design/pro-components';
import Settings from '../../../../config/defaultSettings';

// --- 样式定义 ---
const useStyles = createStyles(({ token }) => {
  return {
    action: {
      marginLeft: '12px',
      color: 'rgba(0, 0, 0, 0.45)',
      fontSize: '28px',
      verticalAlign: 'middle',
      cursor: 'pointer',
      transition: 'color 0.3s',
      '&:hover': {
        color: '#fb7299', // Bilibili粉色
      },
    },
    lang: {
      width: 42,
      height: 42,
      lineHeight: '42px',
      position: 'fixed',
      right: 16,
      borderRadius: token.borderRadius,
      ':hover': {
        backgroundColor: token.colorBgTextHover,
      },
    },
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'auto',
      backgroundImage:
        "url('https://mdn.alipayobjects.com/yuyan_qk0oxh/afts/img/V-_oS6r-i7wAAAAAAAAAAAAAFl94AQBr')", // 可以换成B站风格的背景
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    },
    // 自定义 Bilibili 风格 Logo
    logo: {
      width: 88,
      height: 'auto',
      display: 'block',
      margin: '0 auto 24px',
    }
  };
});

// --- 其他登录方式图标 ---
const ActionIcons = () => {
  const { styles } = useStyles();
  return (
    <>
      <PlayCircleOutlined key="PlayCircleOutlined" className={styles.action} />
      <HeartOutlined key="HeartOutlined" className={styles.action} />
      <SmileOutlined key="SmileOutlined" className={styles.action} />
    </>
  );
};

// --- 语言切换组件 ---
const Lang = () => {
  const { styles } = useStyles();
  return (
    <div className={styles.lang} data-lang>
      {SelectLang && <SelectLang />}
    </div>
  );
};

// --- 错误信息提示框 ---
const LoginMessage: React.FC<{
  content: string;
}> = ({ content }) => {
  return (
    <Alert
      style={{
        marginBottom: 24,
      }}
      message={content}
      type="error"
      showIcon
    />
  );
};

// --- 主登录组件 ---
const Login: React.FC = () => {
  const [userLoginState, setUserLoginState] = useState<API.LoginResult>({});
  const formRef = useRef<ProFormInstance>(); // 使用ProFormInstance类型
  const [type, setType] = useState<string>('account');
  const { initialState, setInitialState } = useModel('@@initialState');
  const { styles } = useStyles();
  const intl = useIntl();

  const fetchUserInfo = async () => {
    const userInfo = await initialState?.fetchUserInfo?.();
    if (userInfo) {
      flushSync(() => {
        setInitialState((s) => ({
          ...s,
          currentUser: userInfo,
        }));
      });
    }
  };

  // --- 提交处理函数 (登录/注册) ---
  const handleSubmit = async (values: any) => {
    try {
      if (type === 'register') {
        // 注册
        const msg = await register(values as API.RegisterParams);
        if (msg.code === 201) {
          const defaultRegisterSuccessMessage = intl.formatMessage({
            id: 'pages.register.success',
            defaultMessage: '注册成功！欢迎成为UP主！',
          });
          message.success(defaultRegisterSuccessMessage);
          setType('account'); // 注册成功后自动跳转到登录页
          return;
        }
        setUserLoginState({ status: 'error', type: 'register', message: msg.message });
      } else {
        // 登录
        const msg = await login({ ...values, type });
        if (msg.code === 200) {
          if (msg.data.token) {
            localStorage.setItem('token', msg.data.token);
          }
          const defaultLoginSuccessMessage = intl.formatMessage({
            id: 'pages.login.success',
            defaultMessage: '登录成功！开始探索吧！',
          });
          message.success(defaultLoginSuccessMessage);
          await fetchUserInfo();
          const urlParams = new URL(window.location.href).searchParams;
          history.push(urlParams.get('redirect') || '/');
          return;
        }
        setUserLoginState(msg);
      }
    } catch (error) {
      const defaultFailureMessage = type === 'register'
        ? intl.formatMessage({
          id: 'pages.register.failure',
          defaultMessage: '注册失败，请再试一次！',
        })
        : intl.formatMessage({
          id: 'pages.login.failure',
          defaultMessage: '登录失败，请检查你的输入！',
        });
      console.log(error);
      message.error(defaultFailureMessage);
    }
  };
  const { status, type: loginType } = userLoginState;

  return (
    <div className={styles.container}>
      <Helmet>
        <title>
          {intl.formatMessage({
            id: 'menu.login',
            defaultMessage: '登录/注册 - 哔哩哔哩',
          })}
          {` - ${Settings.title || 'BiliBili'}`}
        </title>
      </Helmet>
      <Lang />
      <div
        style={{
          flex: '1',
          padding: '32px 0',
        }}
      >
        <LoginForm
          formRef={formRef} // **关键修复：使用formRef属性**
          contentStyle={{
            minWidth: 280,
            maxWidth: '75vw',
          }}
          logo={<img alt="logo" src="/logo.svg" className={styles.logo} />} // B站Logo
          title="Bilibili"
          subTitle={intl.formatMessage({ id: 'pages.layouts.userLayout.title', defaultMessage: '你感兴趣的视频都在B站' })}
          initialValues={{
            autoLogin: true,
          }}
          actions={[
            <FormattedMessage
              key="loginWith"
              id="pages.login.loginWith"
              defaultMessage="更多登录方式"
            />,
            <ActionIcons key="icons" />,
          ]}
          onFinish={async (values) => {
            await handleSubmit(values as API.LoginParams);
          }}
        >
          <Tabs
            activeKey={type}
            onChange={setType}
            centered
            items={[
              {
                key: 'account',
                label: intl.formatMessage({
                  id: 'pages.login.accountLogin.tab',
                  defaultMessage: '密码登录',
                }),
              },
              {
                key: 'mobile',
                label: intl.formatMessage({
                  id: 'pages.login.phoneLogin.tab',
                  defaultMessage: '短信登录',
                }),
              },
              {
                key: 'register',
                label: intl.formatMessage({
                  id: 'pages.login.register.tab',
                  defaultMessage: '注册新账号',
                }),
              },
            ]}
          />

          {/* 错误提示 */}
          {status === 'error' && loginType === 'account' && (
            <LoginMessage
              content={intl.formatMessage({
                id: 'pages.login.accountLogin.errorMessage',
                defaultMessage: '账号或密码不正确哦 ( ´_ゝ｀)',
              })}
            />
          )}
          {status === 'error' && loginType === 'register' && (
            <LoginMessage
              content={userLoginState.message || intl.formatMessage({
                id: 'pages.register.errorMessage',
                defaultMessage: '注册失败，请检查信息是否正确',
              })}
            />
          )}

          {/* 账户密码登录 */}
          {type === 'account' && (
            <>
              <ProFormText
                name="username"
                fieldProps={{
                  size: 'large',
                  prefix: <UserOutlined />,
                }}
                placeholder={intl.formatMessage({
                  id: 'pages.login.username.placeholder',
                  defaultMessage: '你的用户名',
                })}
                rules={[
                  {
                    required: true,
                    message: (
                      <FormattedMessage
                        id="pages.login.username.required"
                        defaultMessage="请输入用户名！"
                      />
                    ),
                  },
                ]}
              />
              <ProFormText.Password
                name="password"
                fieldProps={{
                  size: 'large',
                  prefix: <LockOutlined />,
                }}
                placeholder={intl.formatMessage({
                  id: 'pages.login.password.placeholder',
                  defaultMessage: '你的密码',
                })}
                rules={[
                  {
                    required: true,
                    message: (
                      <FormattedMessage
                        id="pages.login.password.required"
                        defaultMessage="请输入密码！"
                      />
                    ),
                  },
                ]}
              />
            </>
          )}

          {/* 手机登录 */}
          {status === 'error' && loginType === 'mobile' && <LoginMessage content="验证码错误" />}
          {type === 'mobile' && (
            <>
              <ProFormText
                fieldProps={{
                  size: 'large',
                  prefix: <MobileOutlined />,
                }}
                name="mobile"
                placeholder={intl.formatMessage({
                  id: 'pages.login.phoneNumber.placeholder',
                  defaultMessage: '请输入手机号',
                })}
                rules={[
                  {
                    required: true,
                    message: (
                      <FormattedMessage
                        id="pages.login.phoneNumber.required"
                        defaultMessage="手机号不能为空！"
                      />
                    ),
                  },
                  {
                    pattern: /^1\d{10}$/,
                    message: (
                      <FormattedMessage
                        id="pages.login.phoneNumber.invalid"
                        defaultMessage="手机号格式不正确！"
                      />
                    ),
                  },
                ]}
              />
              <ProFormCaptcha
                fieldProps={{
                  size: 'large',
                  prefix: <LockOutlined />,
                }}
                captchaProps={{
                  size: 'large',
                }}
                placeholder={intl.formatMessage({
                  id: 'pages.login.captcha.placeholder',
                  defaultMessage: '请输入验证码',
                })}
                captchaTextRender={(timing, count) => {
                  if (timing) {
                    return `${count} 秒后重发`;
                  }
                  return '获取验证码';
                }}
                name="captcha"
                rules={[
                  {
                    required: true,
                    message: (
                      <FormattedMessage
                        id="pages.login.captcha.required"
                        defaultMessage="请输入验证码！"
                      />
                    ),
                  },
                ]}
                onGetCaptcha={async (phone) => {
                  // 这里可以替换成真实的短信发送API
                  message.success(`验证码已发送至 ${phone}`);
                }}
              />
            </>
          )}

          {/* 注册 */}
          {type === 'register' && (
            <>
              <ProFormText
                name="name"
                fieldProps={{
                  size: 'large',
                  prefix: <UserOutlined />,
                }}
                placeholder={intl.formatMessage({
                  id: 'pages.register.name.placeholder',
                  defaultMessage: '给自己起个响亮的昵称吧',
                })}
                rules={[
                  {
                    required: true,
                    message: '昵称不能为空哦！',
                  },
                  {
                    min: 2,
                    max: 20,
                    message: '昵称长度在2到20个字符之间',
                  },
                ]}
              />
              <ProFormText
                name="email"
                fieldProps={{
                  size: 'large',
                  prefix: <MailOutlined />,
                }}
                placeholder={intl.formatMessage({
                  id: 'pages.register.email.placeholder',
                  defaultMessage: '输入你的邮箱',
                })}
                rules={[
                  {
                    required: true,
                    message: '邮箱不能为空！',
                  },
                  {
                    type: 'email',
                    message: '邮箱格式不正确！',
                  },
                ]}
              />
              <ProFormText.Password
                name="password"
                fieldProps={{
                  size: 'large',
                  prefix: <LockOutlined />,
                }}
                placeholder={intl.formatMessage({
                  id: 'pages.register.password.placeholder',
                  defaultMessage: '设置你的密码',
                })}
                rules={[
                  {
                    required: true,
                    message: '密码不能为空！',
                  },
                  {
                    min: 6,
                    message: '密码长度至少6位',
                  },
                ]}
              />
              <ProFormCaptcha
                fieldProps={{
                  size: 'large',
                  prefix: <LockOutlined />,
                }}
                captchaProps={{
                  size: 'large',
                }}
                placeholder={intl.formatMessage({
                  id: 'pages.register.captcha.placeholder',
                  defaultMessage: '请输入邮箱验证码',
                })}
                captchaTextRender={(timing, count) => {
                  if (timing) {
                    return `${count} 秒后重发`;
                  }
                  return '获取验证码';
                }}
                name="code"
                rules={[
                  {
                    required: true,
                    message: '请输入验证码！',
                  },
                ]}
                onGetCaptcha={async () => {
                  // **关键修复：使用formRef直接获取表单值**
                  try {
                    await formRef.current?.validateFields(['email']);
                    const emailValue = formRef.current?.getFieldValue('email');

                    const result = await sendVerificationCode({
                      email: emailValue,
                      type: 'register',
                    });
                    if (result.code === 200) {
                      message.success('验证码已发送至你的邮箱！');
                      return; // 成功后直接返回
                    } else {
                       message.error(result.message || '验证码发送失败！');
                    }
                  } catch (error) {
                      // 验证失败时 antd pro form 会自动处理提示，这里可以不用额外提示
                      console.log('邮箱验证失败', error);
                  }
                }}
              />
            </>
          )}

          {/* 其他选项 */}
          <div
            style={{
              marginBottom: 24,
            }}
          >
            {type !== 'register' && (
              <ProFormCheckbox noStyle name="autoLogin">
                <FormattedMessage id="pages.login.rememberMe" defaultMessage="自动登录" />
              </ProFormCheckbox>
            )}
            <a
              style={{
                float: 'right',
              }}
            >
              {type === 'register' ? (
                <span>注册即代表同意
                  <a href="#" style={{ color: '#fb7299' }}>《用户协议》</a>和<a href="#" style={{ color: '#fb7299' }}>《隐私政策》</a>
                </span>
              ) : '忘记密码？'}
            </a>
          </div>
        </LoginForm>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
