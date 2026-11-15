package com.royou.keyboard

data class Lang(val code: String, val name: String, val rows: List<String>, val extra: String)

/** 110+ языков: раскладка (3 ряда букв) + полоса дополнительных символов. */
object Languages {
    private const val QW = "qwertyuiop/asdfghjkl/zxcvbnm"
    private const val AZ = "azertyuiop/qsdfghjklm/wxcvbn"
    private const val QZ = "qwertzuiop/asdfghjkl/yxcvbnm"
    private const val DV = "कखगघङचछजझञ/टठडढणतथदधन/पफबभमयरलवशषसह"
    private const val BN = "কখগঘঙচছজঝঞ/টঠডঢণতথদধন/পফবভমযরলশষসহ"
    private const val AR = "ضصثقفغعهخحجد/شسيبلاتنمكط/ئءؤرلاىةوزظ"
    private const val CY = "йцукенгшщзхъ/фывапролджэ/ячсмитьбю"

    private val raw = """
en|English|QW|
ru|Русский|CY|ё
es|Español|QW|ñáéíóúü¿¡
pt|Português|QW|ãõçáéíóúâêô
fr|Français|AZ|éèêëàâçîïôùûüœ
de|Deutsch|QZ|äöüß
it|Italiano|QW|àèéìòù
nl|Nederlands|QW|ëïéèóö
sv|Svenska|QW|åäö
no|Norsk|QW|æøå
da|Dansk|QW|æøå
fi|Suomi|QW|äöå
is|Íslenska|QW|þðæöáéíóúý
pl|Polski|QW|ąćęłńóśźż
cs|Čeština|QZ|áčďéěíňóřšťúůýž
sk|Slovenčina|QZ|áäčďéíĺľňóôŕšťúýž
hu|Magyar|QZ|áéíóöőúüű
ro|Română|QW|ăâîșț
hr|Hrvatski|QZ|čćđšž
sl|Slovenščina|QZ|čšž
bs|Bosanski|QZ|čćđšž
sq|Shqip|QW|çë
lt|Lietuvių|QW|ąčęėįšųūž
lv|Latviešu|QW|āčēģīķļņšūž
et|Eesti|QW|äöõüšž
tr|Türkçe|QW|çğıöşü
az|Azərbaycan|QW|əçğıöşü
uz|Oʻzbek|QW|oʻgʻ
id|Indonesia|QW|
ms|Melayu|QW|
tl|Filipino|QW|ñ
vi|Tiếng Việt|QW|ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ
sw|Kiswahili|QW|
af|Afrikaans|QW|êëéèïôöúü
ca|Català|QW|àçéèíïòóúü·
gl|Galego|QW|áéíñóúü
eu|Euskara|QW|ñç
cy|Cymraeg|QW|âêîôûŵŷ
ga|Gaeilge|QW|áéíóú
mt|Malti|QW|ċġħż
lb|Lëtzebuergesch|QW|äëéü
la|Latina|QW|āēīōū
eo|Esperanto|QW|ĉĝĥĵŝŭ
ht|Kreyòl ayisyen|QW|èòà
mg|Malagasy|QW|
so|Soomaali|QW|
zu|isiZulu|QW|
xh|isiXhosa|QW|
st|Sesotho|QW|
sn|chiShona|QW|
ig|Igbo|QW|ịọụṅ
yo|Yorùbá|QW|àáèéìíòóùúẹọṣ
ha|Hausa|QW|ɓɗƙƴ
ny|Chichewa|QW|
haw|ʻŌlelo Hawaiʻi|QW|āēīōūʻ
mi|Te Reo Māori|QW|āēīōū
sm|Gagana Samoa|QW|āēīōūʻ
ku|Kurdî|QW|çêîşû
gd|Gàidhlig|QW|àèìòù
br|Brezhoneg|QW|ñê
co|Corsu|QW|àèìòù
fy|Frysk|QW|âêôûú
jv|Basa Jawa|QW|
su|Basa Sunda|QW|
ceb|Cebuano|QW|
hmn|Hmoob|QW|
rw|Kinyarwanda|QW|
tk|Türkmen|QW|çäžňöşüýň
uk|Українська|йцукенгшщзхї/фівапролджє/ячсмитьбю|ґ'
be|Беларуская|йцукенгшўзх'/фывапролджэ/ячсмітьбю|ё
bg|Български|яертъуиопчш/асдфгхйклщ/зьцжвбнм|ю
sr|Српски|љњертзуиопш/асдфгхјклчћ/џцвбнмжђ|
mk|Македонски|љњертѕуиопш/асдфгхјклчќ/зџцвбнмжѓ|
kk|Қазақша|йцукенгшщзхъ/фывапролджэ/ячсмитьбю|әғқңөұүһі
ky|Кыргызча|йцукенгшщзхъ/фывапролджэ/ячсмитьбю|ңөү
mn|Монгол|фцуже нгшүзкъ/йыбөахролдпэ/яч ёсмитьвю|
tg|Тоҷикӣ|йцукенгшщзхъ/фывапролджэ/ячсмитьбю|ғӣқӯҳҷ
tt|Татарча|йцукенгшщзхъ/фывапролджэ/ячсмитьбю|әөүңһҗ
ar|العربية|AR|
fa|فارسی|ضصثقفغعهخحجچ/شسیبلاتنمکگ/ظطزرذدپوئ|ژ
ur|اردو|قوعرتےءیہپ/اسدفگھجکل/زشچطبنم|ٹڈڑںۓ
ps|پښتو|ضصثقفغعهخحجچ/شسیبلاتنمکګ/ظطزرډدپوئږ|
sd|سنڌي|AR|ڀٿڦڄڃڇڏڌڊڙ
ckb|کوردی|قوەرتیئحۆپ/اسدفگھژکل/زخجڤبنم|
ug|ئۇيغۇرچە|ئقۋېرتيۇڭوپ/ھسدفگخجكلشغ/زچطبنمژ|
he|עברית|קראטוןםפ/שדגכעיחלךף/זסבהנמצתץ|
yi|ייִדיש|קראטוןםפ/שדגכעיחלךף/זסבהנמצתץ|װױײ
el|Ελληνικά|ςερτυθιοπ/ασδφγηξκλ/ζχψωβνμ|άέήίόύώϊϋ
hy|Հայերեն|քոեռտըւիօպ/ասդֆգհջկլ/զխցվբնմ|
ka|ქართული|ქწერტყუიოპ/ასდფგჰჯკლ/ზხცვბნმ|
am|አማርኛ|ሀለሐመሠረሰሸቀበተ/ቸኀነኘአከኸወዐዘዠ/የደጀገጠጨጰጸፀፈፐ|
hi|हिन्दी|DV|ािीुूृेैोौंःँ्ऽअआइईउऊएऐओऔ
mr|मराठी|DV|ािीुूृेैोौंःँ्ळअआइईउऊएऐओऔ
ne|नेपाली|DV|ािीुूृेैोौंःँ्अआइईउऊएऐओऔ
sa|संस्कृतम्|DV|ािीुूृेैोौंःँ्ऽअआइईउऊऋएऐओऔ
bn|বাংলা|BN|ািীুূৃেৈোৌংঃঁ্অআইঈউঊএঐওঔ
as|অসমীয়া|BN|ািীুূৃেৈোৌংঃঁ্অআইঈউঊএঐওঔৰৱ
gu|ગુજરાતી|કખગઘઙચછજઝઞ/ટઠડઢણતથદધન/પફબભમયરલવશષસહ|ાિીુૂૃેૈોૌંઃઁ્અઆઇઈઉઊએઐઓઔ
pa|ਪੰਜਾਬੀ|ਕਖਗਘਙਚਛਜਝਞ/ਟਠਡਢਣਤਥਦਧਨ/ਪਫਬਭਮਯਰਲਵਸਹ|ਾਿੀੁੂੇੈੋੌਂਃੰ੍ਅਆਇਈਉਊਏਐਓਔ
ta|தமிழ்|கஙசஞடணதநபம/யரலவழளறன/ஜஷஸஹ|ாிீுூெேைொோௌஂஃ்அஆஇஈஉஊஎஏஐஒஓஔ
te|తెలుగు|కఖగఘఙచఛజఝఞ/టఠడఢణతథదధన/పఫబభమయరలవశషసహళ|ాిీుూృెేైొోౌంఃఁ్అఆఇఈఉఊఎఏఐఒఓఔ
kn|ಕನ್ನಡ|ಕಖಗಘಙಚಛಜಝಞ/ಟಠಡಢಣತಥದಧನ/ಪಫಬಭಮಯರಲವಶಷಸಹಳ|ಾಿೀುೂೃೆೇೈೊೋೌಂಃ್ಅಆಇಈಉಊಎಏಐಒಓಔ
ml|മലയാളം|കഖഗഘങചഛജഝഞ/ടഠഡഢണതഥദധന/പഫബഭമയരലവശഷസഹളഴറ|ാിീുൂൃെേൈൊോൌംഃ്അആഇഈഉഊഎഏഐഒഓഔ
or|ଓଡ଼ିଆ|କଖଗଘଙଚଛଜଝଞ/ଟଠଡଢଣତଥଦଧନ/ପଫବଭମଯରଲଵଶଷସହ|ାିୀୁୂୃେୈୋୌଂଃଁ୍ଅଆଇଈଉଊଏଐଓଔ
si|සිංහල|කඛගඝඞචඡජඣඤ/ටඨඩඪණතථදධන/පඵබභමයරලවශෂසහළ|ාිීුූෘෙේෛොෝෞංඃ්අආඉඊඋඌඑඒඓඔඕඖ
th|ไทย|กขคงจฉชซญดตถ/ทธนบปผฝพฟภมย/รลวศษสหฬอฮ|ะาำิีึืุูเแโใไัํ็่้๊๋ๆ์ฯฤฦ๐๑๒๓๔๕๖๗๘๙
lo|ລາວ|ກຂຄງຈສຊຍດຕຖທ/ນບປຜຝພຟມຢຣລ/ວຫອຮ|ະາຳິີຶືຸູເແໂໃໄັ໌ົ່້໊໋ໆ
km|ខ្មែរ|កខគឃងចឆជឈញដឋ/ឌឍណតថទធនបផពភ/មយរលវសហឡអ|ាិីឹឺុូួើឿៀេែៃោៅំះ៉៊់្
my|မြန်မာ|ကခဂဃငစဆဇဈညဋဌ/ဍဏတထဒဓနပဖဗဘမ/ယရလဝသဟဠအ|ာိီုူေဲံ့း်ျြွှ
ko|한국어|ㅂㅈㄷㄱㅅㅛㅕㅑㅐㅔ/ㅁㄴㅇㄹㅎㅗㅓㅏㅣ/ㅋㅌㅊㅍㅠㅜㅡ|ㅃㅉㄸㄲㅆㅒㅖ
ja|日本語|あいうえおかきくけこ/さしすせそたちつてと/なにぬねのはひふへほ|まみむめもやゆよらりるれろわをんー、。ゃゅょっがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ
zh|中文(简体)|的一是不了人我在有他/这中大来上国个到说们/为子和你地出道也时年|，。？！、：；（）…我们他她它好吗呢吧啊的了
zh-TW|中文(繁體)|的一是不了人我在有他/這中大來上國個到說們/為子和你地出道也時年|，。？！、：；（）…我們他她它好嗎呢吧啊
""".trimIndent()

    val all: List<Lang> = raw.lines().filter { it.isNotBlank() }.map { line ->
        val p = line.split("|")
        val rows = when (p[2]) {
            "QW" -> QW; "AZ" -> AZ; "QZ" -> QZ; "DV" -> DV; "BN" -> BN; "AR" -> AR; "CY" -> CY
            else -> p[2]
        }.split("/").map { it.replace(" ", "") }
        Lang(p[0], p[1], rows, p.getOrElse(3) { "" })
    }

    fun byCode(code: String): Lang = all.firstOrNull { it.code == code } ?: all.first()
    fun exists(code: String) = all.any { it.code == code }

    /** Тег языка для распознавания речи. */
    fun voiceTag(l: Lang) = when (l.code) {
        "zh" -> "zh-CN"; "no" -> "nb-NO"; "he" -> "he-IL"; "zh-TW" -> "zh-TW"
        else -> l.code
    }

    /** Код языка для сервиса перевода. */
    fun translateCode(l: Lang) = when (l.code) {
        "zh" -> "zh-CN"; "he" -> "iw"; else -> l.code
    }
}
