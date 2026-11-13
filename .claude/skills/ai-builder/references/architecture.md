# Архитектура ИИ-хаба

## config/models.yaml
```yaml
models:
  - id: chat-main
    kind: chat
    provider: openai_compat
    base_url: https://api.example.com/v1
    model: model-name
    env_key: EXAMPLE_API_KEY
    license: api-terms
    tags: [general, fast]
  - id: local-qwen
    kind: chat
    provider: ollama
    model: qwen2.5:7b
    license: apache-2.0
  - id: img-sd
    kind: image
    provider: diffusers
    model: stabilityai/stable-diffusion-xl-base-1.0
    license: openrail++
```

## Интерфейс провайдера
```python
class Provider:
    def __init__(self, cfg: dict): self.cfg = cfg
    def generate(self, prompt: str, **opts): raise NotImplementedError
```
Реестр: словарь `name -> класс`; `load_model(id)` читает YAML и создаёт экземпляр.

## Роутер (набросок)
```python
def route(task_kind, tags=()):
    cands = [m for m in registry if m.kind == task_kind and m.available()]
    cands.sort(key=lambda m: (-len(set(tags) & set(m.tags)), m.cost))
    return cands
def run(task_kind, prompt, tags=()):
    for m in route(task_kind, tags):
        try: return m.generate(prompt)
        except Exception: continue
    raise RuntimeError("нет доступных моделей")
```

## Дообучение (LoRA)
1. Подготовь датасет JSONL `{"prompt":..., "response":...}`.
2. `peft` + `trl` SFTTrainer, 4-bit (QLoRA) для слабых GPU.
3. Сохрани адаптер в `models/<name>-lora/`, добавь запись в YAML.
Проверь лицензию базовой модели и права на данные.

## Веб-поиск (интерфейс)
`search(query, n=5) -> [{title, url, snippet}]`, затем `fetch(url) -> text`, затем суммаризация с цитатами.
