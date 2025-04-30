const bypass = "K1oNTqR7cjtbhehlqxQgxSP9As13QAeE";
//const currentToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImtWX2RaamRVd19Gd2xDU0R0Vi1hUyJ9.eyJ0cmFuc2Zyb21lZF9zdWIiOiJnb29nbGUtb2F1dGgyfDExNDM1MzExOTEyMzUwMTE4ODg4NSIsImVtYWlsIjoicGF0cmlja0B0aGlyZGVhci5haSIsIm5hbWUiOiJQYXRyaWNrIEthc2wiLCJ0aGlyZGVhcl91c2VyX2lkIjoiYmMzNjMwNDQtMzQ3Ny00MjY5LWI5ODEtYjY5ODZjNDkwODM0IiwiaXNzIjoiaHR0cHM6Ly9kZXYtNXlsbm5td2Q3cmJhejEweS51cy5hdXRoMC5jb20vIiwic3ViIjoib2F1dGgyfEdvb2dsZXwxMTQzNTMxMTkxMjM1MDExODg4ODUiLCJhdWQiOlsiaHR0cHM6Ly9hcGkudGhpcmRlYXIubGl2ZSIsImh0dHBzOi8vZGV2LTV5bG5ubXdkN3JiYXoxMHkudXMuYXV0aDAuY29tL3VzZXJpbmZvIl0sImlhdCI6MTc0NDkyODUzNywiZXhwIjoxNzQ1MDE0OTM3LCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIG9mZmxpbmVfYWNjZXNzIiwiYXpwIjoieGwyclF6OWp6dmphdEdhb3JTdDJzVGhwSmtEZWg3eG4ifQ.lkzDxB2mkntpwMT_gn5ISiGr4O-NGyzpw6fh10TckUR1gLhikcG-AYnhaIeKAKdQsXOIvYCmx8_JB1rTbOzH5ExYuQI0QbvczocWpTENweZI-SUlkg-zAtevoI0itFV4REH2bUGLw6WD07wurPy3ht322csn7SVPmzrZ9FvnVLNB8srGOU4XkiLrLLqRG_XO0Xlpd1s4JMRblYZAQWdbondtAkuOaSRi1_pbyC8_dErczGn9sfZwhw8o2Tg-LsD3E4Sw8HYh-WNPn_sKiKGyTz6VSB3XAKCilry4gv9qEO_GCZQg1zYiU79OaCMBAHWS_eWUUfSG8i1aDvlVnYMljg";
const currentToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InZ1eHI2U3ZtVVI2dlJTVVVhZWJEViJ9.eyJ0cmFuc2Zyb21lZF9zdWIiOiJnb29nbGUtb2F1dGgyfDExNDM1MzExOTEyMzUwMTE4ODg4NSIsImVtYWlsIjoicGF0cmlja0B0aGlyZGVhci5haSIsIm5hbWUiOiJQYXRyaWNrIEthc2wiLCJ0aGlyZGVhcl91c2VyX2lkIjoiZmIwOTcxMmYtNDU1MC00MTRkLTg0MDMtM2U2ZDUwYTkzMzZlIiwiaXNzIjoiaHR0cHM6Ly90aGlyZGVhcmFpLnVzLmF1dGgwLmNvbS8iLCJzdWIiOiJvYXV0aDJ8R29vZ2xlfDExNDM1MzExOTEyMzUwMTE4ODg4NSIsImF1ZCI6WyJodHRwczovL2FwaS50aGlyZGVhci5saXZlIiwiaHR0cHM6Ly90aGlyZGVhcmFpLnVzLmF1dGgwLmNvbS91c2VyaW5mbyJdLCJpYXQiOjE3NDQ5NTM3ODcsImV4cCI6MTc0NTA0MDE4Nywic2NvcGUiOiJvcGVuaWQgcHJvZmlsZSBlbWFpbCBvZmZsaW5lX2FjY2VzcyIsImF6cCI6Ilk0NUw1VVdobXhQNUFYdlB0bGxMS0V6TmJJTDM1N3VvIn0.K7dKwrESGiwKSvEwx232lW_B7JCL0YoYwI_ADZkkBaYRhYC5qLmKX8Hw_X_xikEUCvQa2r-zBMxfuTJHmmRnNvNHzih8ajYGLgQpeq0aO1xcoCqeGs5jc12DzOvixodi6ifGAekta_GrDqxOWfF7k1AGwwfDZwjmnVpqWD17sSmQucvZ6KEqCrPNwtF_1Pszn7rJgubOiq66spDbrpon8i4gyFNnjF62y039rq0_uJ_sCnxzCFCKMkKyCfJpTZh8tkF2u4Hg-e8TPkeEqSGZbW8rfwmGkhGICLMRudi1OtKucH84OGPbeWbKO4rDcDnAlq_s4ffM3Ub3RNiJa80QsA";
const ipaddress = "10.0.0.56";

// /components/helperFuncs/fetchMemories.ts
import { Memory } from '../types/memory'

async function FetchSpecificMemory(meeting_id:string) {
    try {
        
        const response = await fetch(`http://${ipaddress}:3000/api/v1/get_memory`, {
        //const response = await fetch('https://api.thirdear.live/api/v1/get_memory', {
            method: 'POST',
            //mode: 'cors',
            headers: {
                'x-vercel-protection-bypass': bypass,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`,
            },
            body: JSON.stringify({
                meeting_id: meeting_id,
            })
        });


        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const result = await response.json();
        console.log(result.memories[0]);
        return result.memories[0] as Memory;

    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
};

export default FetchSpecificMemory;