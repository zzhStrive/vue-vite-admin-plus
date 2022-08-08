import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import App from './App.vue'

import { initRouter } from '@/router'
import { initStore } from '@/store'
import initStyle from '@/style'
import { initDirective } from './directives'

// import GlobalConfig from '@/config/GlobalConfig/Index'

/**
 * 初始化应用
 */
const initApplication = async () => {
	// 创建实例
	const app = createApp(App)
	// app.config.globalProperties.$GlobalConfig = GlobalConfig;

	// ElementPlus
	app.use(ElementPlus, {
		locale: zhCn
	})

	// 初始化路由
	initRouter(app)

	// 初始化状态管理
	initStore(app)

	// 初始化相关样式
	initStyle()

	// 全局指令的安装
	initDirective(app)

	// 实例挂载
	app.mount('#app')

}

initApplication()
