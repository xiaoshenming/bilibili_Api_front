// @ts-ignore
/* eslint-disable */
import { request } from '@umijs/max';

/** 获取当前的用户 GET /api/currentUser */
export async function currentUser(options?: { [key: string]: any }) {
  return request<{
    success: boolean;
    data: API.CurrentUser;
  }>('/api/status', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 退出登录接口 POST /api/login/outLogin */
export async function outLogin(options?: { [key: string]: any }) {
  return request<Record<string, any>>('/api/logout', {
    method: 'POST',
    ...(options || {}),
  });
}

/** 登录接口 POST /api/login/account */
export async function login(body: API.LoginParams, options?: { [key: string]: any }) {
  return request<API.LoginResult>('/api/pc/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 注册接口 POST /api/register */
export async function register(body: API.RegisterParams, options?: { [key: string]: any }) {
  return request<API.RegisterResult>('/api/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 发送验证码接口 POST /api/send-verification-code */
export async function sendVerificationCode(body: API.SendCodeParams, options?: { [key: string]: any }) {
  return request<API.SendCodeResult>('/api/send-verification-code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 此处后端没有提供注释 GET /api/notices */
export async function getNotices(options?: { [key: string]: any }) {
  return request<API.NoticeIconList>('/api/notices', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取规则列表 GET /api/rule */
export async function rule(
  params: {
    // query
    /** 当前的页码 */
    current?: number;
    /** 页面的容量 */
    pageSize?: number;
  },
  options?: { [key: string]: any },
) {
  return request<API.RuleList>('/api/rule', {
    method: 'GET',
    params: {
      ...params,
    },
    ...(options || {}),
  });
}

/** 更新规则 PUT /api/rule */
export async function updateRule(options?: { [key: string]: any }) {
  return request<API.RuleListItem>('/api/rule', {
    method: 'POST',
    data: {
      method: 'update',
      ...(options || {}),
    },
  });
}

/** 新建规则 POST /api/rule */
export async function addRule(options?: { [key: string]: any }) {
  return request<API.RuleListItem>('/api/rule', {
    method: 'POST',
    data: {
      method: 'post',
      ...(options || {}),
    },
  });
}

/** 删除规则 DELETE /api/rule */
export async function removeRule(options?: { [key: string]: any }) {
  return request<Record<string, any>>('/api/rule', {
    method: 'POST',
    data: {
      method: 'delete',
      ...(options || {}),
    },
  });
}

// ==================== 视频相关接口 ====================

/** 获取用户视频列表 GET /api/video/user-list */
export async function getUserVideoList(options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    data: API.VideoRecord[];
  }>('/api/video/user-list', {
    method: 'GET',
    ...(options || {}),
  });
}

/** 获取所有可下载视频列表 GET /api/video/available */
export async function getAvailableVideos(params?: {
  limit?: number;
  offset?: number;
}, options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    data: {
      videos: API.VideoRecord[];
      total: number;
      hasMore: boolean;
    };
  }>('/api/video/available', {
    method: 'GET',
    params,
    ...(options || {}),
  });
}

/** 解析视频信息 POST /api/video/parse */
export async function parseVideo(body: {
  url: string;
  quality?: number;
}, options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    data: API.VideoInfo;
  }>('/api/video/parse', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 处理视频（下载并入库） POST /api/video/process */
export async function processVideo(body: {
  url: string;
  quality?: number;
  downloadMode?: string;
}, options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    data: API.VideoRecord;
  }>('/api/video/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 批量处理视频 POST /api/video/batch-process */
export async function batchProcessVideos(body: {
  urls: string[];
  quality?: number;
  downloadMode?: string;
}, options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    data: {
      success: API.VideoRecord[];
      failed: { url: string; error: string; }[];
    };
  }>('/api/video/batch-process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 申请视频下载权限 POST /api/video/add-download-permission */
export async function addDownloadPermission(body: {
  bvid: string;
}, options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    data: any;
  }>('/api/video/add-download-permission', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}

/** 查看用户对特定视频的权限 GET /api/video/my-permissions/:bvid */
export async function getVideoPermission(bvid: string, options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    data: {
      hasPermission: boolean;
      relationType?: string;
      relationDesc?: string;
      addedAt?: string;
      videoTitle?: string;
    };
  }>(`/api/video/my-permissions/${bvid}`, {
    method: 'GET',
    ...(options || {}),
  });
}

/** 删除视频 DELETE /api/video/:id */
export async function deleteVideo(id: string, deleteFile: boolean = false, options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    data: null;
  }>(`/api/video/${id}?deleteFile=${deleteFile}`, {
    method: 'DELETE',
    ...(options || {}),
  });
}

/** 生成安全下载链接 POST /api/video/generate-download-link */
export async function generateDownloadLink(body: {
  fileName: string;
}, options?: { [key: string]: any }) {
  return request<{
    code: number;
    message: string;
    data: {
      downloadUrl: string;
      token: string;
      expiresAt: string;
    };
  }>('/api/video/generate-download-link', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    data: body,
    ...(options || {}),
  });
}
