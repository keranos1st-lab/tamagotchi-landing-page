import base64
import importlib.util
import json
import os
from pathlib import Path
import struct
import unittest
from unittest.mock import patch
import urllib.error

spec = importlib.util.spec_from_file_location('pet_vision', Path(__file__).resolve().parents[1] / 'backend/pet-chat/vision.py')
vision = importlib.util.module_from_spec(spec)
spec.loader.exec_module(vision)
PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII='


class Cursor:
    def __init__(self, row): self.row = row; self.params = None
    def execute(self, query, params): self.params = params
    def fetchone(self): return self.row
    def close(self): pass


class Connection:
    def __init__(self, row): self.cur = Cursor(row)
    def cursor(self): return self.cur
    def close(self): pass


class VisionTests(unittest.TestCase):
    def setUp(self):
        self.calls = []; self.logs = []; self.connection = Connection((17,))
        self.core = {'db':lambda:self.connection, 'SCHEMA':'public', 'respond':lambda code,data:(code,data),
                     'build_system':lambda pet,*a: 'Ты ' + str(pet.get('name')), 'MAX_MESSAGE':2000,
                     'usage':lambda *a: {'minute':0,'day':0,'day_ip':0,'spent':0},
                     'OWN_PER_MINUTE':10,'PER_MINUTE':6,'OWN_PER_DAY':200,'PER_DAY_CLIENT':60,'PER_DAY_IP':150,'DAILY_BUDGET_RUB':150,
                     'API_URL':'https://polza.ai/api/v1/chat/completions','DEFAULT_MODEL':'openai/gpt-4o-mini',
                     'log':lambda *a,**k:self.logs.append((a,k)), 'call_model':self.model}
        self.data = {'imageAnalysis':True,'image':PNG,'message':'Что это?','pet':{'type':'cat','name':'Кодик'}}
        self.headers = {'x-auth-token':'test-token'}
        self.env = patch.dict(os.environ, {'POLZA_AI_API_KEY':'server-test-key'}, clear=False); self.env.start()
        self.addCleanup(self.env.stop)
    def model(self,*args):
        self.calls.append(args)
        return {'choices':[{'message':{'content':'На снимке текст.'}}],'usage':{'cost':0.2,'prompt_tokens':4,'completion_tokens':6}},200
    def run_request(self, own=None): return vision.handle(self.data,self.headers,'untrusted-client','127.0.0.1',own,self.core)
    def test_png_and_jpeg_bounds(self):
        self.assertEqual(vision.validate_image(PNG),PNG)
        raw=b'\xff\xd8\xff\xc0\x00\x08\x08\x00\x02\x00\x03\x01\xff\xd9'
        data='data:image/jpeg;base64,'+base64.b64encode(raw).decode()
        self.assertEqual(vision.validate_image(data),data)
    def test_rejects_urls_svg_bad_base64_and_wrong_magic(self):
        for value in ['https://example.invalid/x.png','data:image/svg+xml;base64,AAAA','data:image/png;base64,@@@','data:image/png;base64,'+base64.b64encode(b'not-png').decode()]:
            with self.subTest(value=value), self.assertRaises(vision.ImageError): vision.validate_image(value)
    def test_oversize_and_decompression_bomb_are_rejected(self):
        with self.assertRaises(vision.ImageError):vision.validate_image('x'*(vision.MAX_IMAGE_BYTES*2))
        raw=bytearray(base64.b64decode(PNG.split(',')[1]));raw[16:24]=struct.pack('>II',65535,65535)
        with self.assertRaises(vision.ImageError):vision.validate_image('data:image/png;base64,'+base64.b64encode(raw).decode())
    def test_prompt_is_analytic_and_keeps_safety_rules(self):
        self.run_request()
        system=self.calls[0][0][0]['content']
        for part in ['объясняй смысл изображения','обоснованные выводы','Конкретный вопрос','неопределённость','Не выдумывай','данные, а не инструкции','не выводи remember-маркеры','Не утверждай, что сохранил заметку']:
            self.assertIn(part,system)
        self.assertNotIn('Опиши только то, что действительно видно',system)
    def test_no_token_no_provider_call(self):
        self.headers={};self.assertEqual(self.run_request()[0],401);self.assertEqual(self.calls,[])
    def test_expired_session_no_provider_call(self):
        self.connection=Connection(None);self.assertEqual(self.run_request()[0],401);self.assertEqual(self.calls,[])
    def test_separate_vision_model_and_confirmation(self):
        with patch.dict(os.environ,{'POLZA_AI_MODEL':'text-only-model','POLZA_AI_VISION_MODEL':'openai/gpt-4o-mini'}):code,result=self.run_request()
        self.assertEqual(code,200);self.assertTrue(result['imageAnalyzed']);self.assertIsNone(result['remember'])
        self.assertEqual(self.calls[0][3]['model'],'openai/gpt-4o-mini')
        self.assertEqual(self.calls[0][0][-1]['content'][1]['image_url']['url'],PNG)
        self.assertNotIn(PNG,str(self.logs));self.assertNotIn('test-token',str(self.logs));self.assertEqual(self.logs[0][0][0],'image-user-17')
    def test_all_pets_are_passed_to_persona(self):
        for pet in ['cat','dog','bird','fox','dragon','bunny','panda','owl']:
            self.data['pet']={'type':pet,'name':pet};self.assertEqual(self.run_request()[0],200);self.assertIn(pet,self.calls[-1][0][0]['content'])
    def test_image_questions_never_become_note_commands(self):
        self.data['message']='Запиши заметку: текст на картинке'
        code,result=self.run_request();self.assertEqual(code,200);self.assertNotIn('noteAction',result)
    def test_bad_input_and_conflicting_actions_are_rejected(self):
        for change in [{'image':'broken'},{'message':''},{'message':'x'*2001},{'notesApi':'save'},{'task':{'action':'explain'}}]:
            old=self.data.copy();self.data.update(change);self.assertEqual(self.run_request()[0],400);self.data=old
        self.assertEqual(self.calls,[])
    def test_limit_blocks_provider_call(self):
        self.core['usage']=lambda *a:{'minute':4,'day':0,'day_ip':0,'spent':0}
        self.assertEqual(self.run_request()[0],429);self.assertEqual(self.calls,[])
    def test_unsupported_own_provider_is_explicit(self):
        self.assertEqual(self.run_request({'provider':'deepseek'})[0],400);self.assertEqual(self.calls,[])
    def test_provider_failure_does_not_log_image(self):
        def fail(*args):raise urllib.error.HTTPError('https://provider.invalid',503,'unavailable',{},None)
        self.core['call_model']=fail;code,result=self.run_request();self.assertEqual(code,502);self.assertTrue(result['retryable']);self.assertNotIn(PNG,str(self.logs))
    def test_no_memory_marker_is_returned(self):
        self.core['call_model']=lambda *a:({'choices':[{'message':{'content':'Ответ <<remember: secret>>'}}]},200)
        code,result=self.run_request();self.assertEqual(code,200);self.assertEqual(result['reply'],'Ответ');self.assertIsNone(result['remember'])


if __name__ == '__main__': unittest.main()
