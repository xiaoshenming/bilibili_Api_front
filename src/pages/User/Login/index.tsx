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
