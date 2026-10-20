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
  const TIPOS_URBANOS=new Set(['RUA','AVENIDA','TRAVESSA','PRACA','ALAMEDA']);
  const LIGACOES=new Set(['DE','DA','DO','DAS','DOS','E']);

  // Separa "AVENIDA" de "JOAO PINHEIRO" e devolve as palavras que identificam o nome
  function nucleo(nome){
    let t=norm(nome).split(' ').filter(Boolean);
    let tipo='';
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
    const qs=new Set(q.palavras),cs=new Set(c.palavras);
    const dentro=(a,b)=>[...a].every(w=>b.has(w));
    // "LI GUERRA" dentro de "PREFEITO LI GUERRA", ou o contrário
    if(q.chave.length>=4&&dentro(qs,cs))return .82+.13*qs.size/cs.size;
    if(c.chave.length>=4&&dentro(cs,qs))return .80+.13*cs.size/qs.size;
    // Erros de digitação: "AFONSO ARINO" e "AFONSO ARINOS"
    if(Math.abs(q.chave.length-c.chave.length)>Math.max(4,q.chave.length*.35))return 0;
    const r=razao(q.som,c.som);
    return r>=.82?.9*r:0;
  }

  const metros=(a,b)=>{const dy=(a[0]-b[0])*111320,dx=(a[1]-b[1])*111320*Math.cos(a[0]*Math.PI/180);return Math.hypot(dx,dy);};

  // Lê o texto da ficha: rua, número e bairro
  function lerEndereco(texto){
    let t=String(texto||'').split('→')[0].replace(/\([^)]*\)/g,' ');
    // "Rua X com Rua Y", "esquina com Avenida Y": fica a primeira
    t=t.split(/\s(?:esquina\s+com|esq\.?|com)\s+(?:a\s+)?(?=(?:rua|r\.|av\.?|avenida|travessa|trav\.?)\s)/i)[0];
    t=t.replace(/\s(?:esquina|esq\.?)\s.*$/i,'');
    // Bairro: depois de " - ", "–" ou "—"
    const partes=t.split(/\s+-\s+|\s*[–—]\s*/).map(s=>s.trim()).filter(Boolean);
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
    if(numero==null&&virg.length===1){const m=nomeRua.match(/^(.*\D)\s+(\d+)\s*$/);if(m&&!/^\s*(rua|r|av|avenida)\.?\s*$/i.test(m[1])){nomeRua=m[1];numero=+m[2];}}
    // Bairro sem traço: "Água Santa, Centro"
    const restoTxt=resto.replace(/\d+|\bn[ºo°]\.?|\be\b/gi,' ').trim();
    return{rua:nomeRua.replace(/\bn[ºo°]\.?\s*$/i,'').trim(),numero,bairro,extras,restoTxt};
  }

  function criar(dados){
    const esc=dados.escala||100000;
    const bairros=dados.bairros.map(([nome,la,ln])=>({nome,ll:[la/esc,ln/esc],n:nucleo(nome)}));
    const ruas=dados.ruas.map(([nome,bi,la,ln,plano])=>{
      const nums=[];
      for(let i=0;i<plano.length;i+=3)nums.push([plano[i],(la+plano[i+1])/esc,(ln+plano[i+2])/esc]);
      return{nome,bairro:bairros[bi],ll:[la/esc,ln/esc],nums,n:nucleo(nome)};
    });
    // Agrupa por nome para comparar cada nome uma vez
    const porNome=new Map();
    ruas.forEach(r=>{if(!porNome.has(r.nome))porNome.set(r.nome,{n:r.n,trechos:[]});porNome.get(r.nome).trechos.push(r);});
    const nomes=[...porNome.values()];
    const memo=new Map();
    // Centro da cidade: trechos a mais de 7 km (distritos e zona rural) perdem para os da sede no empate
    const centro=(bairros.find(b=>b.nome==='CENTRO')||bairros[0]).ll;
    const RAIO_SEDE=7000;

    function acharBairro(txt){
      if(!txt)return null;
      const q=nucleo(txt);if(!q.chave)return null;
      let melhor=null,nota=0;
      for(const b of bairros){
        let s=semelhanca(q,b.n);
        if(q.chave===b.n.chave)s=1.01; // exato vence o "dentro de"
        if(s>nota){nota=s;melhor=b;}
      }
      return nota>=.85?melhor:null;
    }
    // Procura um bairro escrito no meio do texto ("CDI Distrito Industrial")
    function bairroNoTexto(txt){
      const t=' '+norm(txt)+' ';let melhor=null;
      for(const b of bairros){const k=' '+norm(b.nome)+' ';if(b.nome.length>=5&&t.includes(k)&&(!melhor||b.nome.length>melhor.nome.length))melhor=b;}
      return melhor;
    }

    // Ponto do número na rua: exato, interpolado entre vizinhos ou o mais próximo
    function pontoNumero(trecho,num){
      const ns=trecho.nums;if(num==null||!ns.length)return null;
      let lo=null,hi=null;
      for(const p of ns){
        if(p[0]===num)return{ll:[p[1],p[2]],exato:true};
        if(p[0]<num)lo=p;else if(!hi)hi=p;
      }
      if(lo&&hi&&hi[0]-lo[0]<=600){const f=(num-lo[0])/(hi[0]-lo[0]);return{ll:[lo[1]+(hi[1]-lo[1])*f,lo[2]+(hi[2]-lo[2])*f],exato:false};}
      const viz=[lo,hi].filter(Boolean).sort((a,b)=>Math.abs(a[0]-num)-Math.abs(b[0]-num))[0];
      if(viz&&Math.abs(viz[0]-num)<=150)return{ll:[viz[1],viz[2]],exato:false};
      return null;
    }

    function candidatosRua(txt){
      const q=nucleo(txt);if(!q.chave)return[];
      const out=[];
      for(const nm of nomes){
        let s=semelhanca(q,nm.n);if(s<.8)continue;
        if(q.tipo&&nm.n.tipo)s+=q.tipo===nm.n.tipo?.02:-.06;
        else if(!q.tipo&&!TIPOS_URBANOS.has(nm.n.tipo))s-=.05;
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
      let cands=[];
      for(const txt of [e.rua,...e.extras]){const c=candidatosRua(txt);if(c.length){cands=c;break;}}
      let res=null;
      if(cands.length){
        const opcoes=[];
        for(const {s,nm} of cands)for(const tr of nm.trechos){
          let nb=0;
          if(qb)nb=tr.bairro===qb?1:metros(tr.ll,qb.ll)<700?.5:0;
          const sl=s-(metros(tr.ll,centro)>RAIO_SEDE?.05:0);
          const pn=pontoNumero(tr,e.numero);
          opcoes.push({tr,s:sl,nb,pn,total:sl+.6*nb+(pn&&pn.exato?.15:pn?.05:0)});
        }
        opcoes.sort((a,b)=>b.total-a.total);
        const top=opcoes[0];
        // Sem bairro que decida: ruas de mesmo nome em lugares distantes ficam como ambíguas
        // (o número sozinho não decide: o cadastro não tem todos os números de cada rua)
        const rivais=opcoes.filter(o=>o.tr.bairro!==top.tr.bairro&&o.s>=top.s-.03&&o.nb>=top.nb&&metros(o.tr.ll,top.tr.ll)>1000);
        if(rivais.length&&top.nb<1){
          res=qb?{ll:qb.ll,precisao:'bairro',bairro:qb.nome,motivo:'rua com esse nome em vários bairros'}
                :{erro:'ambiguo',opcoes:[top,...rivais].map(o=>`${o.tr.nome} (${o.tr.bairro.nome})`)};
        }else if(qb&&top.nb===0&&metros(top.tr.ll,qb.ll)>1500){
          // A rua achada fica longe do bairro informado: confia no bairro
          res={ll:qb.ll,precisao:'bairro',bairro:qb.nome,motivo:`${top.tr.nome} não fica em ${qb.nome}`};
        }else{
          let pn=top.pn;
          // Número em outro trecho da mesma rua (avenidas que passam por vários bairros)
          if(e.numero!=null&&!(pn&&pn.exato)){
            for(const o of opcoes)if(o.tr.nome===top.tr.nome&&o.pn&&o.pn.exato&&metros(o.tr.ll,top.tr.ll)<1500){pn=o.pn;break;}
          }
          res=pn?{ll:pn.ll,precisao:'numero',exato:pn.exato,rua:top.tr.nome,numero:e.numero,bairro:top.tr.bairro.nome}
                :{ll:top.tr.ll,precisao:'rua',rua:top.tr.nome,bairro:top.tr.bairro.nome};
        }
      }else{
        const b=qb||bairroNoTexto(texto);
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
