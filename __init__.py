# -*- coding: utf-8 -*-
"""
hosepen - ComfyUI实时绘画插件
可以在浏览器中实时绘画
"""

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS
from .server import add_routes

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']

# Web目录
WEB_DIRECTORY = "./web"

# 版本信息
__version__ = "1.0.0"
__author__ = "Horse Team"
__description__ = "hosepen - ComfyUI实时绘画插件"

print(f"[hosepen] v{__version__} - {__description__}")
print(f"[hosepen] 正在加载插件...")

# ComfyUI路由注册
try:
    from server import PromptServer
    from pathlib import Path
    from aiohttp import web
    
    @PromptServer.instance.routes.get('/hosepen/api/drawings')
    async def get_drawings_route(request):
        from .server import hosepen_server
        return await hosepen_server.get_drawings(request)
    
    @PromptServer.instance.routes.post('/hosepen/api/drawings')
    async def save_drawing_route(request):
        from .server import hosepen_server
        return await hosepen_server.save_drawing(request)
    
    # 添加路由来提供 stickman-editor.html 文件
    @PromptServer.instance.routes.get('/hosepen/stickman-editor.html')
    async def get_stickman_editor(request):
        try:
            # 获取插件目录
            plugin_dir = Path(__file__).parent
            html_file = plugin_dir / 'web' / 'stickman-editor.html'
            
            if html_file.exists():
                with open(html_file, 'r', encoding='utf-8') as f:
                    html_content = f.read()
                return web.Response(text=html_content, content_type='text/html')
            else:
                return web.Response(text=f'File not found: {html_file}', status=404)
        except Exception as e:
            print(f"[hosepen] 加载 stickman-editor.html 失败: {e}")
            return web.Response(text=f'Error loading file: {str(e)}', status=500)
    
    print("[hosepen] 路由注册成功")
except Exception as e:
    print(f"[hosepen] 路由注册失败: {e}")
    
    # 备用方式
    def setup_routes(routes):
        """为ComfyUI设置路由"""
        try:
            add_routes(routes)
            print("[hosepen] 路由注册成功（备用方式）")
        except Exception as e:
            print(f"[hosepen] 路由注册失败: {e}")
    
    __all__.append('setup_routes')
