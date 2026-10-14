"""Builds the single-file app (index.html at the repo root, ready for GitHub Pages)."""
import pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
order = ['structures.js', 'algorithms.js', 'engine.js', 'experiments.js', 'tests.js', 'app.js']
js = '\n'.join((src / f).read_text() for f in order)
html = (src / 'index.template.html').read_text() \
    .replace('/*__CSS__*/', (src / 'style.css').read_text()) \
    .replace('/*__JS__*/', js.replace('</script>', '<\\/script>'))
(root / 'index.html').write_text(html)
print('built index.html', len(html) // 1024, 'KB')
