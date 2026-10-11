import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 从仓库根目录的 .env 读取 WFS 编辑用户凭据
  const env = loadEnv(mode, '..', '')
  const editorUser = env.WFS_EDITOR_USER
  const editorPassword = env.WFS_EDITOR_PASSWORD

  const authorization = editorUser && editorPassword
    ? `Basic ${Buffer.from(`${editorUser}:${editorPassword}`).toString('base64')}` : ''

  return {
    envDir: '..',
    plugins: [vue()],

    server: {
      proxy: {
        '/wfs-transaction': {
          target: 'http://localhost:18080',
          changeOrigin: true,

          // 将固定代理地址转发到 GeoServer WFS 接口
          rewrite: path => path.replace(
            /^\/wfs-transaction/,
            '/geoserver/ogc_lab/wfs',
          ),

          // 认证头只在 Vite 开发服务器中添加，不会进入浏览器代码
          configure(proxy) {
            proxy.on('proxyReq', proxyRequest => {
              if (authorization) {
                proxyRequest.setHeader('Authorization', authorization)
              }
            })
          },
        },
      },
    },
  }
})
