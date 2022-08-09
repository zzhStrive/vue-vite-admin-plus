/**
 * 全局路由拦截器处理
 */

import { NavigationGuardNext, RouteLocationNormalized, Router } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import lodash from 'lodash'

import { SysRouterMenu } from 'types/SysRouterMenu'

import { UseSysStore } from '@/store/modules/SysStore'
import { UseSysRouteMenuStore } from '@/store/modules/SysRouteMenu'
import { SysBaseConfig } from '@/config/GlobalConfig/Index'


import { getLocalKey } from '@/utils/common/HandleLocalStorageUtil'

// 处理路由的相关函数
import { filterAsyncVAdminRoute, mountRoute } from './utils/HandleAsyncVAdminRoute'
import transformVAdminRouteToRouteRecordRaw from './utils/TransformVAdminRoute'
import createSysMenuRecord from './utils/CreateSysMenu'

// 所有的系统路由
import BasicRoutes, { Redirect404Router } from './modules/BasicRoutes'
import BusinessRoutes from './modules/BusinessRoutes'

/**
 * 路由菜单处理程序
 *  1. 获取用户信息
 *  2. 筛选异步路由
 *  3. 挂载路由
 *  4. 生成菜单
 *  5. 初始化相关状态管理
 */
const routeMenuHandleProcess = async (SysStore: any, SysRouteMenuStore: any, RouterInstance: Router) => {
	// 1. 获取用户信息
	await SysStore.setSysUserInfo()
	// 获取用户权限
	const Permissions = SysStore.SysUserInfo.permissions

	// 判断当前项目配置由什么控制路由权限
	const handleSysPermission = SysStore.SysBaseConfig.handleSysPermission as SysBasicConfig.SysHandlePermission

	// 2. 系统异步路由
	let VAdminAsyncRouters: SysRouterMenu.VAdminRoute[] = []
	// 根据项目业务修改
	if (handleSysPermission === 'STATIC_PERMISSION') {
		// 前端静态异步路由表
		VAdminAsyncRouters = lodash.cloneDeep(BusinessRoutes)
	} else if (handleSysPermission === 'DYNAMIC_PERMISSION') {
		VAdminAsyncRouters = await SysStore.getUserAsyncRouterBasicServe()
	} else {
		// 前端静态异步路由表
		VAdminAsyncRouters = lodash.cloneDeep(BusinessRoutes)
	}

	// 过滤好的VAdmin异步(业务)路由
	const FilterSuccessVAdminAsyncRouters = filterAsyncVAdminRoute(VAdminAsyncRouters, Permissions)

	// 将所有路由表 转换为 VueRouter 路由表 RouteRecordRaw[]
	const TransformToAsyncRouters = transformVAdminRouteToRouteRecordRaw(FilterSuccessVAdminAsyncRouters)
	const TransformToConstantRouters = transformVAdminRouteToRouteRecordRaw(BasicRoutes)


	// 3. 挂载路由
	TransformToAsyncRouters.forEach(route => {
		mountRoute(route, RouterInstance)
	})
	// 4. 生成菜单
	const CreateSuccessSysMenuRecord = createSysMenuRecord([...TransformToConstantRouters, ...TransformToAsyncRouters])
	// 5. 初始化相关状态管理
	SysRouteMenuStore.ConstantVAdminRouters = BasicRoutes
	SysRouteMenuStore.AsyncVAdminRouters = BusinessRoutes
	SysRouteMenuStore.MountedAsyncVAdminRouters = FilterSuccessVAdminAsyncRouters
	SysRouteMenuStore.AllRouterRecord = [...TransformToConstantRouters, ...TransformToAsyncRouters]
	SysRouteMenuStore.AllConstantRouterRecord = TransformToConstantRouters
	SysRouteMenuStore.AllAsyncRouterRecord = TransformToAsyncRouters
	SysRouteMenuStore.AllMenuRecord = CreateSuccessSysMenuRecord
	SysRouteMenuStore.AllRouteCollect = RouterInstance.getRoutes()
}

/**
 * 路由全局控制守卫：
 * 1. 有Token的情况
 *  1. 第一次从登录页登录后存在Token，挂载异步路由
 *  2. 页面刷新后存在Token, 需要重新挂载异步路由
 *  3. 不可以手动修改URL跳转登陆页面
 *  4. 正常的页面跳转
 * 2. 没有Token的情况
 *  1. 没有Token前提 查询要跳转的页面是否是不需要Token的，如果需要返回到登录页面
 *  2. 没有Token前提 查询要跳转的页面是否是不需要Token的，如果不需要这进入该页面
 */

// 白名单路由（不需要token，定义路由name）
const { whiteRouteByName } = SysBaseConfig

export default async (
	to: RouteLocationNormalized,
	from: RouteLocationNormalized,
	next: NavigationGuardNext,
	RouterInstance: Router
) => {
	const SysStore = UseSysStore()
	const SysRouteMenuStore = UseSysRouteMenuStore()

	// 用户Token
	const LocalUserToken = getLocalKey('VAdminToken')?.trim()

	/**
	 * 通过 isAddAsyncRouter 来控制 第一次登陆和刷新页面后 是否添加了动态路由
	 * 注意：next({ path: to.path, replace: false }) 和 next()的理解
	 */

	if (LocalUserToken && LocalUserToken !== '') {
		console.log('to', to);

		// 1. 有Token
		if (from.name === 'Login' && to.name !== 'Login') {
			// 1.1 第一次从登录页跳转的情况
			if (!SysRouteMenuStore.IsAddAsyncRouter) {
				await routeMenuHandleProcess(SysStore, SysRouteMenuStore, RouterInstance)
				SysRouteMenuStore.IsAddAsyncRouter = true
				next({ path: to.fullPath, replace: true })
				return
			}
		} else if (from.name === undefined && to.name !== 'Login') {
			// 1.2 刷新页面的情况
			if (!SysRouteMenuStore.IsAddAsyncRouter) {
				await routeMenuHandleProcess(SysStore, SysRouteMenuStore, RouterInstance)
				SysRouteMenuStore.IsAddAsyncRouter = true
				// setTimeout(() => {
				next({ path: to.fullPath, replace: true })
				// }, 0)
				return
			}
		} else if (to.name === 'Login') {
			// 1.3 想手动跳转登录页，返回指定页面
			// next({ name: 'Login' })
			next()
			return
		}

		// 挂载404通用路由 只在系统第一次进行挂载即可
		if (!SysRouteMenuStore.IsMounted404Router) {
			mountRoute(Redirect404Router as RouteRecordRaw, RouterInstance)
			SysRouteMenuStore.IsMounted404Router = true
		}

		// 路由放行
		next()
	} else {
		// 2. 没有Token
		// 2.1 检查是否配置了白名单
		const isAccess = whiteRouteByName.includes(to.name as string)
		// 2.2 如果跳转的页面是配置了白名单的，则放行，否则强制跳转登录页面
		// eslint-disable-next-line no-unused-expressions
		isAccess ? next() : next({ name: 'Login' })
	}
}
