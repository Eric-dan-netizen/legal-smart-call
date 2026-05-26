import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/el-icon.css'
import App from './App.vue'
import router from './router'
import axios from 'axios'

// 配置 Axios - 通过 Vite 代理到后端
axios.defaults.baseURL = '/api'

const app = createApp(App)

app.use(ElementPlus)
app.use(router)
app.mount('#app')