# -*- coding: utf-8 -*-
"""
hosepen服务器路由模块
"""
from pathlib import Path
from aiohttp import web
import json
import os
import base64

class HosepenServer:
    """hosepen服务器"""
    
    def __init__(self):
        self.data_file = Path(__file__).parent / 'drawings.json'
        self.ensure_data_file()
    
    def ensure_data_file(self):
        """确保数据文件存在"""
        if not self.data_file.exists():
            default_data = {
                'drawings': []
            }
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(default_data, f, ensure_ascii=False, indent=2)
    
    def load_data(self):
        """加载数据"""
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[hosepen] 加载数据失败: {e}")
            return {'drawings': []}
    
    def save_data(self, data):
        """保存数据"""
        try:
            with open(self.data_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"[hosepen] 保存数据失败: {e}")
            return False
    
    async def get_drawings(self, request):
        """获取绘画列表"""
        try:
            data = self.load_data()
            return web.json_response({
                'success': True,
                'data': data
            })
        except Exception as e:
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)
    
    async def save_drawing(self, request):
        """保存绘画"""
        try:
            body = await request.json()
            drawing_data = body.get('drawing')
            title = body.get('title', '未命名')
            
            if not drawing_data:
                return web.json_response({
                    'success': False,
                    'error': '缺少绘画数据'
                }, status=400)
            
            data = self.load_data()
            
            import time
            new_drawing = {
                'id': str(int(time.time() * 1000)),
                'title': title,
                'data': drawing_data,
                'created_at': time.time()
            }
            
            data['drawings'].append(new_drawing)
            
            if self.save_data(data):
                return web.json_response({
                    'success': True,
                    'data': new_drawing
                })
            else:
                return web.json_response({
                    'success': False,
                    'error': '保存失败'
                }, status=500)
                
        except Exception as e:
            print(f"[hosepen] 保存绘画失败: {e}")
            return web.json_response({
                'success': False,
                'error': str(e)
            }, status=500)

# 创建全局实例
hosepen_server = HosepenServer()

def add_routes(routes):
    """添加路由（备用方式）"""
    pass
