<template>
  <el-container class="layout-container">
    <el-aside width="200px">
      <div class="logo">法律外呼系统</div>
      <el-menu 
        :default-active="activeMenu" 
        router 
        class="el-menu-vertical"
      >
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>数据概览</span>
        </el-menu-item>
        <el-menu-item index="/customers">
          <el-icon><User /></el-icon>
          <span>客户管理</span>
        </el-menu-item>
        <el-menu-item index="/tasks">
          <el-icon><Phone /></el-icon>
          <span>外呼任务</span>
        </el-menu-item>
        <el-menu-item index="/scripts">
          <el-icon><Document /></el-icon>
          <span>话术管理</span>
        </el-menu-item>
        <el-menu-item index="/call-logs">
          <el-icon><Headset /></el-icon>
          <span>通话记录</span>
        </el-menu-item>
        <el-menu-item index="/statistics">
          <el-icon><TrendCharts /></el-icon>
          <span>数据统计</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header>
        <div class="header-right">
          <span>欢迎，{{ username }}</span>
          <el-button type="danger" size="small" @click="logout">退出</el-button>
        </div>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { DataAnalysis, User, Phone, Document, TrendCharts, Headset } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const activeMenu = computed(() => route.path)
const username = ref(localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).username : 'Admin')

const logout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  router.push('/login')
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}
.el-aside {
  background: #304156;
}
.logo {
  height: 60px;
  line-height: 60px;
  text-align: center;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
}
.el-menu-vertical {
  border: none;
  background: #304156;
}
.el-menu-item {
  color: #bfcbd9;
}
.el-menu-item:hover,
.el-menu-item.is-active {
  background: #263445 !important;
  color: #409eff !important;
}
.el-header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.header-right {
  display: flex;
  align-items: center;
  gap: 15px;
}
.el-main {
  background: #f0f2f5;
}
</style>