/**
 * 图片代理工具函数
 * 用于解决哔哩哔哩图片防盗链问题
 */

/**
 * 将哔哩哔哩图片URL转换为代理URL
 * @param originalUrl 原始图片URL
 * @returns 代理后的URL
 */
export const convertBilibiliImageUrl = (originalUrl: string): string => {
  if (!originalUrl || typeof originalUrl !== 'string') {
    return '';
  }

  // 检查是否是哔哩哔哩图片URL
  if (originalUrl.includes('hdslb.com')) {
    // 替换不同的图片服务器域名为对应的代理路径
    if (originalUrl.includes('i0.hdslb.com')) {
      return originalUrl.replace('https://i0.hdslb.com', '/bilibili-img').replace('http://i0.hdslb.com', '/bilibili-img');
    } else if (originalUrl.includes('i1.hdslb.com')) {
      return originalUrl.replace('https://i1.hdslb.com', '/bilibili-img1').replace('http://i1.hdslb.com', '/bilibili-img1');
    } else if (originalUrl.includes('i2.hdslb.com')) {
      return originalUrl.replace('https://i2.hdslb.com', '/bilibili-img2').replace('http://i2.hdslb.com', '/bilibili-img2');
    }
  }

  // 如果不是哔哩哔哩图片，返回原URL
  return originalUrl;
};

/**
 * 获取安全的图片URL
 * @param pic 图片URL，可能是字符串或对象
 * @returns 安全的图片URL字符串
 */
export const getSafeImageUrl = (pic: any): string => {
  let imageUrl = '';
  
  if (typeof pic === 'string') {
    imageUrl = pic;
  } else if (pic && typeof pic === 'object' && pic.url) {
    imageUrl = pic.url;
  } else if (pic && typeof pic === 'object' && pic.src) {
    imageUrl = pic.src;
  }
  
  return convertBilibiliImageUrl(imageUrl);
};