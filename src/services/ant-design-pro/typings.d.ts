// @ts-ignore
/* eslint-disable */

declare namespace API {
  type CurrentUser = {
    name?: string;
    avatar?: string;
    userid?: string;
    email?: string;
    signature?: string;
    title?: string;
    group?: string;
    tags?: { key?: string; label?: string }[];
    notifyCount?: number;
    unreadCount?: number;
    country?: string;
    access?: string;
    role?: string;
    geographic?: {
      province?: { label?: string; key?: string };
      city?: { label?: string; key?: string };
    };
    address?: string;
    phone?: string;
  };

  // type LoginResult = {
  //   status?: string;
  //   type?: string;
  //   currentAuthority?: string;
  //   token?: string;
  // };
  type LoginResult = {
    status?: string;
    type?: string;
    currentAuthority?: string;
    code: number;
    message: string;
    data: {
      token: string;
      role: string;
      name: string;
      id: number;
    };
  };

  type PageParams = {
    current?: number;
    pageSize?: number;
  };

  type RuleListItem = {
    key?: number;
    disabled?: boolean;
    href?: string;
    avatar?: string;
    name?: string;
    owner?: string;
    desc?: string;
    callNo?: number;
    status?: number;
    updatedAt?: string;
    createdAt?: string;
    progress?: number;
  };

  type RuleList = {
    data?: RuleListItem[];
    /** 列表的内容总数 */
    total?: number;
    success?: boolean;
  };

  type FakeCaptcha = {
    code?: number;
    status?: string;
  };

  type LoginParams = {
    username?: string;
    password?: string;
    autoLogin?: boolean;
    type?: string;
  };

  type RegisterParams = {
    name: string;
    email: string;
    password: string;
    code?: string;
  };

  type RegisterResult = {
    code: number;
    message: string;
    data: null;
  };

  type SendCodeParams = {
    email: string;
    type: string;
  };

  type SendCodeResult = {
    code: number;
    message: string;
    data: null;
  };

  type ErrorResponse = {
    /** 业务约定的错误码 */
    errorCode: string;
    /** 业务上的错误信息 */
    errorMessage?: string;
    /** 业务上的请求是否成功 */
    success?: boolean;
  };

  type NoticeIconList = {
    data?: NoticeIconItem[];
    /** 列表的内容总数 */
    total?: number;
    success?: boolean;
  };

  type NoticeIconItemType = 'notification' | 'message' | 'event';

  type NoticeIconItem = {
    id?: string;
    extra?: string;
    key?: string;
    read?: boolean;
    avatar?: string;
    title?: string;
    status?: string;
    datetime?: string;
    description?: string;
    type?: NoticeIconItemType;
  };

  // ==================== 视频相关类型定义 ====================

  type VideoInfo = {
    bvid: string;
    aid: number;
    title: string;
    pic: string;
    desc: string;
    duration: number;
    pubdate: number;
    owner: {
      mid: number;
      name: string;
      face: string;
    };
    stat: {
      view: number;
      danmaku: number;
      reply: number;
      favorite: number;
      coin: number;
      share: number;
      like: number;
    };
    pages: {
      cid: number;
      page: number;
      from: string;
      part: string;
      duration: number;
      vid: string;
      weblink: string;
      dimension: {
        width: number;
        height: number;
        rotate: number;
      };
    }[];
    tname: string;
    copyright: number;
    tid: number;
    argue_info: {
      argue_msg: string;
      argue_type: number;
      argue_link: string;
    };
    dynamic: string;
    cid: number;
    dimension: {
      width: number;
      height: number;
      rotate: number;
    };
    premiere: null;
    teenage_mode: number;
    is_chargeable_season: boolean;
    is_story: boolean;
    no_cache: boolean;
    subtitle: {
      allow_submit: boolean;
      list: any[];
    };
    staff: any[];
    is_season_display: boolean;
    user_garb: {
      url_image_ani_cut: string;
    };
    honor_reply: {};
    like_icon: string;
    need_jump_bv: boolean;
    disable_show_up_info: boolean;
  };

  type VideoRecord = {
    id: string;
    bvid: string;
    aid: number;
    title: string;
    pic: string;
    desc: string;
    duration: number;
    pubdate: number;
    publish_time: string;
    owner_name: string;
    owner_mid: number;
    owner_face: string;
    view_count: number;
    danmaku_count: number;
    reply_count: number;
    favorite_count: number;
    coin_count: number;
    share_count: number;
    like_count: number;
    tname: string;
    copyright: number;
    tid: number;
    dynamic: string;
    cid: number;
    dimension_width: number;
    dimension_height: number;
    dimension_rotate: number;
    file_path: string;
    file_size: number;
    download_url: string;
    quality: number;
    download_mode: string;
    status: string;
    error_message: string;
    created_at: string;
    updated_at: string;
    user_id: number;
    tags: string[];
  };

  type VideoPermission = {
    hasPermission: boolean;
    relationType?: string;
    relationDesc?: string;
    addedAt?: string;
    videoTitle?: string;
  };

  type DownloadTask = {
    id: string;
    url: string;
    title: string;
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    progress: number;
    error?: string;
    createdAt: string;
  };

  type BatchProcessResult = {
    success: VideoRecord[];
    failed: {
      url: string;
      error: string;
    }[];
  };

  type DownloadLink = {
    downloadUrl: string;
    token: string;
    expiresAt: string;
  };
}
