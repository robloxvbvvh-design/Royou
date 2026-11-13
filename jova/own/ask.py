import sys, numpy as np
from tokenizer import Tokenizer
from model import LM
from chat import generate
tok = Tokenizer.load('models/tokenizer.json'); m = LM.load('models/jova-own.npz')
for q in sys.argv[1:]:
    ids = [t for t, _ in generate(m, tok, q, rng=np.random.default_rng(3))]
    print('Q:', q, '\nA:', tok.decode(ids), '\n')
