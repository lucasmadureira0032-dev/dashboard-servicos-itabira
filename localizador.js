// Localizador de endereços de Itabira (MG) a partir do CNEFE do Censo 2022 (IBGE).
// Recebe o texto digitado na ficha ("Seis, 124 - Madre Maria de Jesus") e devolve a coordenada
// do número, da rua ou do bairro, sempre usando o bairro para escolher entre ruas de mesmo nome.
// Funciona no navegador (window.LocalizadorItabira) e no Node (require).
(function(raiz,fabrica){
  if(typeof module==='object'&&module.exports)module.exports=fabrica();
  else raiz.LocalizadorItabira=fabrica();
})(typeof self!=='undefined'?self:this,function(){
  'use strict';

  const semAcento=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'');
  // Maiúsculas, sem acento e só letras/números separados por um espaço
  const norm=s=>semAcento(String(s||'')).toUpperCase().replace(/[ºª°]/g,' ').replace(/[^A-Z0-9]+/g,' ').trim();

  // Tipos de logradouro e suas abreviações (primeira palavra do nome)
  const TIPOS={RUA:'RUA',R:'RUA',AVENIDA:'AVENIDA',AV:'AVENIDA',AVE:'AVENIDA',AVDA:'AVENIDA',
    TRAVESSA:'TRAVESSA',TRAV:'TRAVESSA',TV:'TRAVESSA',TR:'TRAVESSA',PRACA:'PRACA',PCA:'PRACA',PC:'PRACA',
    ALAMEDA:'ALAMEDA',AL:'ALAMEDA',RODOVIA:'RODOVIA',ROD:'RODOVIA',BECO:'BECO',ESTRADA:'ESTRADA',EST:'ESTRADA',
    LARGO:'LARGO',VIELA:'VIELA',ESCADARIA:'ESCADARIA',ACESSO:'ACESSO',LADEIRA:'LADEIRA',PASSAGEM:'PASSAGEM'};
  // Títulos abreviados nos nomes de rua
  const TITULOS={DR:'DOUTOR',DRA:'DOUTORA',PROF:'PROFESSOR',PROFA:'PROFESSORA',PREF:'PREFEITO',VER:'VEREADOR',
    CEL:'CORONEL',TEN:'TENENTE',CAP:'CAPITAO',MAJ:'MAJOR',SGT:'SARGENTO',GAL:'GENERAL',GEN:'GENERAL',MAL:'MARECHAL',
    PRES:'PRESIDENTE',PE:'PADRE',MONS:'MONSENHOR',ENG:'ENGENHEIRO',DEP:'DEPUTADO',SEN:'SENADOR',GOV:'GOVERNADOR',
    STA:'SANTA',STO:'SANTO',SRA:'SENHORA',NSA:'NOSSA SENHORA',NSRA:'NOSSA SENHORA',NS:'NOSSA SENHORA'};
  // Números por extenso viram algarismos, para "Rua Cinco" e "Rua 5" se encontrarem
  const NUMEROS={UM:1,UMA:1,DOIS:2,DUAS:2,TRES:3,QUATRO:4,CINCO:5,SEIS:6,SETE:7,OITO:8,NOVE:9,DEZ:10,ONZE:11,DOZE:12,
    TREZE:13,QUATORZE:14,CATORZE:14,QUINZE:15,DEZESSEIS:16,DEZESSETE:17,DEZOITO:18,DEZENOVE:19,VINTE:20,TRINTA:30,
    QUARENTA:40,CINQUENTA:50,SESSENTA:60,SETENTA:70,OITENTA:80,NOVENTA:90,CEM:100,CENTO:100};
  // Tipos de via rural ou de acesso: perdem para rua/avenida quando a ficha não diz o tipo
  // Quando a ficha não diz o tipo, quase sempre é rua ou avenida: os outros tipos perdem um pouco no empate
  const PENALIDADE_SEM_TIPO={RUA:0,AVENIDA:0,'':0,TRAVESSA:.04,PRACA:.04,ALAMEDA:.04,BECO:.04,VIELA:.04,ESCADARIA:.04};
  const LIGACOES=new Set(['DE','DA','DO','DAS','DOS','E']);
  // Nome popular (usado nas fichas e no CEP) → nome no cadastro do IBGE. As duas vias passam a ser uma só.
  // "Av. Prefeito Li Guerra" (CEP 35900-279, Praia) é a AVENIDA PREFEITO OLIMPIO PIRES GUERRA do cadastro;
  // o trecho que o IBGE chama de LI GUERRA tem só 5 endereços, logo depois do fim dela.
  const APELIDOS=[['AVENIDA LI GUERRA','AVENIDA PREFEITO OLIMPIO PIRES GUERRA']];

  // Separa "AVENIDA" de "JOAO PINHEIRO" e devolve as palavras que identificam o nome
  function nucleo(nome){
    let t=norm(nome).split(' ').filter(Boolean);
    let tipo='';
    if(t.length===1&&TIPOS[t[0]])return{tipo:TIPOS[t[0]],palavras:[],chave:'',som:''};
    if(t.length>1&&TIPOS[t[0]]){tipo=TIPOS[t[0]];t=t.slice(1);}
    t=t.flatMap(w=>(TITULOS[w]||w).split(' '));
    // "SESSENTA E TRES" → "63"
    const u=[];
    for(let i=0;i<t.length;i++){
      if(NUMEROS[t[i]]!=null){
        let v=NUMEROS[t[i]];
        while(t[i+1]==='E'&&NUMEROS[t[i+2]]!=null){v+=NUMEROS[t[i+2]];i+=2;}
        u.push(String(v));
      }else u.push(t[i]);
    }
    t=u.filter(w=>!LIGACOES.has(w));
    const chave=t.join(' ');
    return{tipo,palavras:t,chave,som:t.map(fonetica).join(' ')};
  }
  // Grafias que soam igual: OZORIO/OSORIO, LUIS/LUIZ, KENEDY/KENNEDY, THEREZA/TEREZA
  function fonetica(w){
    return w.replace(/PH/g,'F').replace(/TH/g,'T').replace(/Y/g,'I').replace(/W/g,'V').replace(/Z/g,'S').replace(/K/g,'C')
      .replace(/(^|[^CLN])H/g,'$1').replace(/([A-Z])\1+/g,'$1');
  }

  function levenshtein(a,b){
    if(a===b)return 0;
    const m=a.length,n=b.length;if(!m)return n;if(!n)return m;
    let ant=new Array(n+1),cur=new Array(n+1);
    for(let j=0;j<=n;j++)ant[j]=j;
    for(let i=1;i<=m;i++){
      cur[0]=i;
      for(let j=1;j<=n;j++)cur[j]=Math.min(ant[j]+1,cur[j-1]+1,ant[j-1]+(a[i-1]===b[j-1]?0:1));
      [ant,cur]=[cur,ant];
    }
    return ant[n];
  }
  const razao=(a,b)=>1-levenshtein(a,b)/Math.max(a.length,b.length,1);

  // Semelhança entre dois nomes (0 a 1) pelas palavras do núcleo
  function semelhanca(q,c){
    if(!q.chave||!c.chave)return 0;
    if(q.chave===c.chave)return 1;
    if(q.som===c.som)return .97;
    // Compara pelas palavras como soam: "OSORIO SAMPAIO" dentro de "VEREADOR OZORIO SAMPAIO"
    const qs=new Set(q.som.split(' ')),cs=new Set(c.som.split(' '));
    const dentro=(a,b)=>[...a].every(w=>b.has(w));
    // "LI GUERRA" dentro de "PREFEITO LI GUERRA", ou o contrário
    if(q.som.length>=4&&dentro(qs,cs))return .82+.13*qs.size/cs.size;
    // ...mas uma palavra solta ("CAMPO" em "CONGONHAS DO CAMPO") não basta: precisa cobrir boa parte do texto
    const letras=x=>x.replace(/ /g,'').length;
    if(c.som.length>=4&&dentro(cs,qs)&&(cs.size>=2||letras(c.som)>=.6*letras(q.som)))return .80+.13*cs.size/qs.size;
    // Todas as palavras da ficha estão no nome, alguma com erro de digitação: "JOSE BERNARDINHO" em "JOSE JOAO BERNADINO"
    if(qs.size>=2){
      let pior=1,exatas=0;
      for(const w of qs){
        let m=0;
        for(const v of cs){const r=w===v?1:razao(w,v);if(r>m)m=r;}
        if(m===1)exatas++;
        if(m<pior)pior=m;
      }
      if(exatas>=1&&pior>=.8)return .78+.1*pior*qs.size/cs.size;
    }
    // Erros de digitação: "AFONSO ARINO" e "AFONSO ARINOS"
    if(Math.abs(q.chave.length-c.chave.length)>Math.max(4,q.chave.length*.35))return 0;
    const r=razao(q.som,c.som);
    return r>=.82?.9*r:0;
  }

  const metros=(a,b)=>{const dy=(a[0]-b[0])*111320,dx=(a[1]-b[1])*111320*Math.cos(a[0]*Math.PI/180);return Math.hypot(dx,dy);};

  // Lê o texto da ficha: rua, número e bairro
  function lerEndereco(texto){
    let t=String(texto||'').split('→')[0];
    // Rua da esquina, mesmo entre parênteses: "Um, 135 (esquina com Rua João dos Santos Cunha)"
    const mEsq=t.match(/esquina\s+com\s+(?:a\s+)?([^)\-–—,]+)/i);
    let esquina=mEsq?mEsq[1].trim():'';
    t=t.replace(/\([^)]*\)/g,' ');
    // Bairro: depois de " - ", "–" ou "—"
    const partes=t.split(/\s+-\s+|\s*[–—]\s*/).map(s=>s.trim()).filter(Boolean);
    // "Rua X com Rua Y", "Rua X esquina com Avenida Y": a rua é a primeira, a outra vira esquina
    if(partes.length){
      const sp=partes[0].split(/\s(?:esquina\s+com|esq\.?|com)\s+(?:a\s+)?(?=(?:rua|r\.|av\.?|avenida|travessa|trav\.?)\s)/i);
      if(sp.length>1&&!esquina)esquina=sp[1].split(',')[0].trim();
      partes[0]=sp[0].replace(/\s(?:esquina|esq\.?)\s.*$/i,'').trim();
    }
    let bairro='',ruaTxt=partes[0]||'';
    const extras=[];
    if(partes.length>1){
      let ult=partes[partes.length-1];
      if(/[a-zA-Z]{2}/.test(ult)){
        // "Rodovia Luiz Menezes, Barreiro": o bairro vem depois da última vírgula
        const v=ult.split(',');
        bairro=v.pop().trim();
        if(v.length)extras.push(v.join(','));
        partes.pop();
      }
      extras.push(...partes.slice(1).filter(p=>/[a-zA-Z]{3}/.test(p)));
      ruaTxt=partes[0];
    }
    bairro=bairro.replace(/^\s*bairro\s+/i,'');
    // Número: primeiro inteiro depois do nome ("Rua X, nº 109", "293 Av. X")
    let numero=null;
    const ini=ruaTxt.match(/^\s*(\d+)\s+(?=[A-Za-zÀ-ú])/);
    if(ini){numero=+ini[1];ruaTxt=ruaTxt.slice(ini[0].length);}
    const virg=ruaTxt.split(',');
    let nomeRua=virg[0];
    const resto=virg.slice(1).join(',');
    if(numero==null){const m=resto.match(/\d+/);if(m)numero=+m[0];}
    // Sem vírgula: "Duque de Caxias 899"
    // ("DW 82" e "MG 129" fazem parte do nome: sigla curta antes do número não é rua)
    let colado=false;
    if(numero==null&&virg.length===1){const m=nomeRua.match(/^(.*\D)\s+(\d+)\s*$/);if(m&&!/^\s*(rua|r|av|avenida)\.?\s*$/i.test(m[1])&&!/^\s*[A-Za-z]{1,3}\s*$/.test(m[1])){nomeRua=m[1];numero=+m[2];colado=true;}}
    // Bairro sem traço: "Água Santa, Centro"
    const restoTxt=resto.replace(/\d+|\bn[ºo°]\.?|\be\b/gi,' ').trim();
    return{rua:nomeRua.replace(/\bn[ºo°]\.?\s*$/i,'').trim(),numero,bairro,extras,restoTxt,esquina,colado};
  }

  function criar(dados){
    const esc=dados.escala||100000;
    const bairros=dados.bairros.map(([nome,la,ln,casos])=>({nome,ll:[la/esc,ln/esc],casos:casos||0,n:nucleo(nome)}));
    const ruas=dados.ruas.map(([nome,bi,la,ln,plano])=>{
      const nums=[];
      for(let i=0;i<plano.length;i+=3)nums.push([plano[i],(la+plano[i+1])/esc,(ln+plano[i+2])/esc]);
      return{nome,bairro:bairros[bi],ll:[la/esc,ln/esc],nums,n:nucleo(nome)};
    });
    // Agrupa por nome para comparar cada nome uma vez
    const porNome=new Map();
    ruas.forEach(r=>{if(!porNome.has(r.nome))porNome.set(r.nome,{n:r.n,trechos:[]});const g=porNome.get(r.nome);g.trechos.push(r);r.grupo=g;});
    // Junta cada apelido ao nome do cadastro: o texto pode bater com qualquer um, e os números valem para os dois
    porNome.forEach(g=>{g.alt=[];});
    for(const [apelido,oficial] of APELIDOS){
      const g=porNome.get(oficial);if(!g)continue;
      g.alt.push(nucleo(apelido));
      const ga=porNome.get(apelido);
      if(ga&&ga!==g){ga.trechos.forEach(t=>{t.grupo=g;});g.trechos.push(...ga.trechos);porNome.set(apelido,g);}
    }
    const nomes=[...new Set(porNome.values())];
    // Palavras comuns em nomes de rua (JOSE, MARIA, SANTA...) não servem para identificar uma rua sozinhas
    const freq=new Map();
    nomes.forEach(nm=>new Set(nm.n.som.split(' ')).forEach(w=>freq.set(w,(freq.get(w)||0)+1)));
    const rara=w=>w.length>=5&&!/^\d+$/.test(w)&&(freq.get(w)||0)<=8;
    const memo=new Map();
    // Centro da cidade: trechos a mais de 7 km (distritos e zona rural) perdem para os da sede no empate
    const centro=(bairros.find(b=>b.nome==='CENTRO')||bairros[0]).ll;
    const RAIO_SEDE=7000;

    function acharBairro(txt){
      if(!txt)return null;
      const q=nucleo(txt);if(!q.chave)return null;
      let melhor=null,nota=0;
      for(const b of bairros){
        let s;
        if(q.chave===b.n.chave)s=1.01; // exato vence o "dentro de"
        else if(q.som===b.n.som)s=1;
        else if(q.som.length<4)continue; // "B" de "119 B" não é bairro
        else if((b.n.som.startsWith(q.som)||q.som.startsWith(b.n.som))&&Math.abs(b.n.som.length-q.som.length)<=2)s=.95;
        else s=Math.max(semelhanca(q,b.n),razao(q.som,b.n.som)>=.8?razao(q.som,b.n.som):0);
        if(s>nota){nota=s;melhor=b;}
      }
      return nota>=.8?melhor:null;
    }
    // Procura um bairro escrito no meio do texto ("CDI Distrito Industrial")
    function bairroNoTexto(e){
      // O nome da rua só entra quando o texto não parece endereço (sem tipo de via e sem número): "CDI Distrito Industrial"
      const semRua=e.numero==null&&!nucleo(e.rua).tipo;
      const t=' '+norm([semRua?e.rua:'',e.bairro,...e.extras,e.restoTxt].join(' '))+' ';let melhor=null;
      for(const b of bairros){
        if(b.nome.length<5||b.casos<30||metros(b.ll,centro)>RAIO_SEDE)continue;
        const k=' '+norm(b.nome)+' ';
        if(t.includes(k)&&(!melhor||b.nome.length>melhor.nome.length))melhor=b;
      }
      return melhor;
    }
    // Nome do cadastro em formato de título; siglas ("MG-129", "DW") ficam em maiúsculas
    const tit=n=>String(n||'').split(' ').map((w,i)=>/\d/.test(w)||/^[^AEIOU]{1,3}$/.test(w)?w:i>0&&/^(D[AEO]S?|E)$/.test(w)?w.toLowerCase():w.charAt(0)+w.slice(1).toLowerCase()).join(' ');

    // Ponto do número na rua: exato, interpolado entre vizinhos ou o mais próximo
    function pontoNumero(trecho,num){
      const ns=trecho.nums;if(num==null||!ns.length)return null;
      let lo=null,hi=null;
      for(const p of ns){
        if(p[0]===num)return{ll:[p[1],p[2]],exato:true};
        if(p[0]<num)lo=p;else if(!hi)hi=p;
      }
      if(lo&&hi&&hi[0]-lo[0]<=600){const f=(num-lo[0])/(hi[0]-lo[0]);return{ll:[lo[1]+(hi[1]-lo[1])*f,lo[2]+(hi[2]-lo[2])*f],exato:false};}
      return null;
    }

    // Número na rua, olhando todos os trechos próximos da mesma rua (avenidas passam por vários bairros).
    // Ignora pontos fora de sequência no cadastro e, quando o bairro informado tem números em volta do
    // procurado, prefere a estimativa nele a um número "exato" em outro bairro.
    // Dois trechos da mesma via que se encostam (avenida que passa por vários bairros) são a mesma rua
    const memoContiguos=new Map();
    function contiguos(a,b){
      if(a.grupo!==b.grupo)return false;
      if(!a.id){a.id=1+memoContiguos.size+Math.random();}if(!b.id){b.id=2+memoContiguos.size+Math.random();}
      const k=a.id<b.id?a.id+'|'+b.id:b.id+'|'+a.id;
      if(!memoContiguos.has(k))memoContiguos.set(k,contiguosCalc(a,b));
      return memoContiguos.get(k);
    }
    function contiguosCalc(a,b){
      const amostra=t=>t.nums.length?t.nums.filter((_,i)=>i%Math.ceil(t.nums.length/40)===0).map(p=>[p[1],p[2]]):[t.ll];
      const pa=amostra(a),pb=amostra(b);
      for(const x of pa)for(const y of pb)if(metros(x,y)<300)return true;
      return false;
    }
    // Estimativa entre os números vizinhos; "intervalo" mede a confiança (menor é melhor)
    // Pares de um lado da rua, ímpares do outro: tenta primeiro os vizinhos do mesmo lado
    function interpolar(pts,num){
      const lado=pts.filter(p=>p.n%2===num%2);
      const r=lado.length>=2?interpolarEm(lado,num):null;
      return r&&r.intervalo<600?r:interpolarEm(pts,num)||r;
    }
    function interpolarEm(pts,num){
      let lo=null,hi=null;
      for(const p of pts){if(p.n<num&&(!lo||p.n>lo.n))lo=p;if(p.n>num&&(!hi||p.n<hi.n))hi=p;}
      // Vizinhos longe demais para a diferença de números (um deles fora de sequência): não interpola,
      // fica com o de número mais próximo
      if(lo&&hi&&hi.n-lo.n<=600&&metros(lo.ll,hi.ll)<=Math.max(100,4*(hi.n-lo.n))){const f=(num-lo.n)/(hi.n-lo.n);return{ll:[lo.ll[0]+(hi.ll[0]-lo.ll[0])*f,lo.ll[1]+(hi.ll[1]-lo.ll[1])*f],intervalo:hi.n-lo.n};}
      const viz=[lo,hi].filter(Boolean).sort((a,b)=>Math.abs(a.n-num)-Math.abs(b.n-num))[0];
      return viz&&Math.abs(viz.n-num)<=150?{ll:viz.ll,intervalo:2*Math.abs(viz.n-num)+600}:null;
    }
    function numeroNaRua(tr,num){
      if(num==null)return null;
      const trechos=porNome.get(tr.nome).trechos.filter(t=>t===tr||metros(t.ll,tr.ll)<2000);
      const pts=[];
      trechos.forEach(t=>t.nums.forEach(([n,la,ln])=>pts.push({n,ll:[la,ln],tr:t})));
      // Fora de sequência: longe dos 4 números mais próximos da mesma rua, que por sua vez estão juntos
      const mediana=a=>{const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)];};
      const ok=pts.filter(p=>{
        const viz=pts.filter(q=>q!==p&&Math.abs(q.n-p.n)<=60).sort((a,b)=>Math.abs(a.n-p.n)-Math.abs(b.n-p.n)).slice(0,4);
        if(viz.length<2)return true;
        const m=[mediana(viz.map(q=>q.ll[0])),mediana(viz.map(q=>q.ll[1]))];
        const juntos=viz.every(q=>metros(q.ll,m)<=100);
        return !(juntos&&metros(p.ll,m)>150);
      });
      // Número fora da faixa do cadastro: perto da faixa, ponto na ponta da rua; longe, no meio do trecho.
      // Em nenhum dos casos o ponto promete o número.
      if(ok.length){
        const ns=ok.map(p=>p.n),min=Math.min(...ns),max=Math.max(...ns);
        if(num<min-30||num>max+30){
          const fora=num<min?min-num:num-max;
          if(fora>150)return{ll:tr.ll,exato:false,foraDaFaixa:[min,max],ponta:false};
          const ponta=ok.filter(p=>p.n===(num<min?min:max)).sort((a,b)=>metros(a.ll,tr.ll)-metros(b.ll,tr.ll))[0];
          return{ll:ponta.ll,exato:false,foraDaFaixa:[min,max],ponta:true};
        }
      }
      // Rua cujos números estão todos no mesmo ponto: o número não acrescenta posição
      const doTrecho=ok.filter(p=>p.tr===tr);
      if(doTrecho.length>=3&&doTrecho.every(p=>metros(p.ll,doTrecho[0].ll)<20))return{ll:tr.ll,exato:false,semPosicao:true};
      const exatos=ok.filter(p=>p.n===num);
      const estT=interpolar(doTrecho,num);
      const estTrecho=estT&&estT.ll;
      const noTrecho=exatos.find(p=>p.tr===tr);
      if(noTrecho)return{ll:noTrecho.ll,exato:true,tr};
      if(exatos.length){
        const ref=estTrecho||tr.ll;
        const e=exatos.sort((a,b)=>metros(a.ll,ref)-metros(b.ll,ref))[0];
        if(!(estTrecho&&metros(e.ll,estTrecho)>200))return{ll:e.ll,exato:true,tr:e.tr};
      }
      // Vizinhos mais próximos num trecho colado da mesma rua valem mais que um intervalo largo no trecho do bairro
      const estP=interpolar(ok,num);
      if(estT&&estP&&estP.intervalo*2<=estT.intervalo&&metros(estP.ll,estT.ll)<400)return{ll:estP.ll,exato:false};
      if(estT)return{ll:estT.ll,exato:false};
      return estP&&metros(estP.ll,tr.ll)<1500?{ll:estP.ll,exato:false}:null;
    }

    function candidatosRua(txt){
      const q=nucleo(txt);if(!q.chave)return[];
      const out=[],qw=new Set(q.palavras);
      for(const nm of nomes){
        // Atalho: só compara letra a letra nomes que dividem uma palavra ou começam com a mesma letra
        const formas=[nm.n,...nm.alt];
        if(!formas.some(f=>f.som[0]===q.som[0]||f.palavras.some(w=>qw.has(w))))continue;
        let s=Math.max(...formas.map(f=>semelhanca(q,f)));if(s<.8)continue;
        if(q.tipo&&nm.n.tipo)s+=q.tipo===nm.n.tipo?.02:-.06;
        else if(!q.tipo)s-=PENALIDADE_SEM_TIPO[nm.n.tipo]??.06;
        out.push({s,nm});
      }
      return out;
    }

    function localizar(texto){
      const chave=norm(texto);
      if(memo.has(chave))return memo.get(chave);
      const e=lerEndereco(texto);
      let qb=acharBairro(e.bairro)||(e.restoTxt?acharBairro(e.restoTxt):null);
      // Testa o nome da rua e os outros pedaços do texto que podem ser a rua
      let cands=[],numero=e.numero;
      for(const txt of [e.rua,...e.extras]){const c=candidatosRua(txt);if(c.length){cands=c;break;}}
      // "Rua DW 82": sem vírgula, o número pode ser parte do nome; só vale se a rua com ele existir
      if(!cands.length&&e.colado){const c=candidatosRua(e.rua+' '+e.numero);if(c.length){cands=c;numero=null;}}
      // Ruas em código no bairro informado: "W 87" é a RUA DW OITENTA E SETE, "Um" é a RUA BW UM do Gabiroba
      if(qb&&!cands.some(({nm})=>nm.trechos.some(tr=>tr.bairro===qb))){
        const q=nucleo(e.rua),qw=q.som.split(' ').filter(Boolean);
        const sigla=w=>w.length<=3&&/^[A-Z]+$/.test(w);
        if(qw.length&&qw.length<=2&&qw.slice(0,-1).every(sigla)){
          const ult=qw[qw.length-1];
          const achadas=nomes.filter(nm=>{
            const cw=nm.n.som.split(' ');
            if(cw.length<2||cw[cw.length-1]!==ult||!cw.slice(0,-1).every(sigla)||!nm.trechos.some(tr=>tr.bairro===qb))return false;
            return qw.length===1||levenshtein(qw[0],cw[0])<=1;
          });
          if(achadas.length===1)cands=[{s:.85,nm:achadas[0]}];
        }
      }
      // A rua principal não existe no bairro informado (ou não existe): tenta a rua da esquina
      if(e.esquina&&(!cands.length||(qb&&!cands.some(({nm})=>nm.trechos.some(tr=>tr.bairro===qb))))){
        const ce=candidatosRua(e.esquina);
        if(ce.length&&(!qb||ce.some(({nm})=>nm.trechos.some(tr=>tr.bairro===qb)))){cands=ce;numero=null;}
      }
      // Grafia muito diferente ("Hildebrando" por "Hidemburgo"): com o bairro conhecido, uma palavra pouco comum
      // que aparece numa única rua do bairro identifica a rua
      let porPalavra='';
      if(!cands.length&&qb){
        const q=nucleo(e.rua),qr=q.som.split(' ').filter(rara);
        const achadas=qr.length?nomes.filter(nm=>nm.trechos.some(tr=>tr.bairro===qb)&&nm.n.som.split(' ').some(w=>qr.includes(w))):[];
        if(achadas.length===1){
          cands=[{s:.8,nm:achadas[0]}];
          const iw=achadas[0].n.som.split(' ').findIndex(w=>qr.includes(w));
          porPalavra=achadas[0].n.palavras[iw]||qr[0];
        }
      }
      let res=null;
      if(cands.length){
        const opcoes=[];
        for(const {s,nm} of cands)for(const tr of nm.trechos){
          let nb=0;
          if(qb)nb=tr.bairro===qb?1:metros(tr.ll,qb.ll)<700?.5:0;
          const sl=s-(metros(tr.ll,centro)>RAIO_SEDE?.05:0);
          const pn=pontoNumero(tr,numero);
          // (desempate: o trecho com mais endereços no cadastro)
          opcoes.push({tr,s:sl,nb,pn,total:sl+.6*nb+(pn&&pn.exato?.15:pn?.05:0)+.002*Math.log1p(tr.nums.length)});
        }
        opcoes.sort((a,b)=>b.total-a.total);
        const top=opcoes[0];
        // Sem bairro que decida: ruas de mesmo nome em lugares distantes ficam como ambíguas
        // (o número sozinho não decide: o cadastro não tem todos os números de cada rua)
        const rivais=opcoes.filter(o=>o.tr.bairro!==top.tr.bairro&&o.s>=top.s-.03&&o.nb>=top.nb&&metros(o.tr.ll,top.tr.ll)>1000&&!contiguos(o.tr,top.tr));
        // Ruas diferentes de nome parecido no mesmo bairro, longe uma da outra, também não dão para decidir
        const parecidas=opcoes.filter(o=>o.tr.grupo!==top.tr.grupo&&o.tr.bairro===top.tr.bairro&&top.total-o.total<.03&&metros(o.tr.ll,top.tr.ll)>500);
        if(rivais.length&&top.nb<1){
          res=qb?{ll:qb.ll,precisao:'bairro',bairro:qb.nome,motivo:`há ${tit(top.tr.nome)} em vários bairros, mas não em ${tit(qb.nome)}`}
                :{erro:'ambiguo',opcoes:[top,...rivais].map(o=>`${o.tr.nome} (${o.tr.bairro.nome})`)};
        }else if(parecidas.length){
          res=qb?{ll:qb.ll,precisao:'bairro',bairro:qb.nome,motivo:`${tit(top.tr.nome)} e ${tit(parecidas[0].tr.nome)} têm nomes parecidos e ficam longe uma da outra`}
                :{erro:'ambiguo',opcoes:[top,...parecidas].map(o=>`${o.tr.nome} (${o.tr.bairro.nome})`)};
        }else if(qb&&top.nb===0&&metros(top.tr.ll,qb.ll)>1500){
          // A rua achada fica longe do bairro informado: confia no bairro
          res={ll:qb.ll,precisao:'bairro',bairro:qb.nome,motivo:`${tit(top.tr.nome)} não fica em ${tit(qb.nome)}`};
        }else{
          const pn=numeroNaRua(top.tr,numero);
          res=pn&&pn.semPosicao?{ll:pn.ll,precisao:'rua',rua:top.tr.nome,numero,bairro:top.tr.bairro.nome,
                motivo:'o cadastro não tem a posição de cada número nesta rua; ponto no meio da rua'}
             :pn&&pn.foraDaFaixa?{ll:pn.ll,precisao:'rua',rua:top.tr.nome,numero,bairro:top.tr.bairro.nome,
                motivo:`nº ${numero} fora dos números do cadastro, que vão de ${pn.foraDaFaixa[0]} a ${pn.foraDaFaixa[1]}; ponto ${pn.ponta?'na ponta mais próxima da rua':'no meio do trecho'}`}
             :pn?{ll:pn.ll,precisao:'numero',exato:pn.exato,rua:top.tr.nome,numero,bairro:top.tr.bairro.nome}
                :{ll:top.tr.ll,precisao:'rua',rua:top.tr.nome,numero,bairro:top.tr.bairro.nome,
                  motivo:numero!=null?'número não encontrado; ponto no meio da rua':''};
          // "Travessa dos Cravos II": o cadastro junta as travessas de mesmo nome e o número não diz qual é a II
          const romano=w=>/^(I|II|III|IV|V|VI)$/.test(w);
          const qr=nucleo(e.rua).palavras.filter(romano);
          if(res.precisao==='numero'&&qr.length&&!qr.every(w=>top.tr.n.palavras.includes(w))){
            res={ll:top.tr.ll,precisao:'rua',rua:top.tr.nome,numero,bairro:top.tr.bairro.nome,
              motivo:`a ficha diz "${e.rua}", mas o cadastro junta as vias com esse nome; ponto no meio delas`};
          }
          if(porPalavra){res.precisao='rua';res.ll=top.tr.ll;res.motivo=`nome escrito de outro jeito na ficha; é a única rua de ${tit(qb.nome)} com "${tit(porPalavra)}" no nome`;}
        }
      }else{
        const b=qb||bairroNoTexto(e);
        res=b?{ll:b.ll,precisao:'bairro',bairro:b.nome,motivo:'rua não encontrada no cadastro'}:{erro:'nao_encontrado'};
      }
      res.entrada=e;
      memo.set(chave,res);
      return res;
    }
    return{localizar,lerEndereco,metros,bairros,ruas};
  }
  return{criar,norm,nucleo,lerEndereco};
});
